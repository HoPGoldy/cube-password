import { FC, useState } from "react";
import { Alert, Button, Col, Form, Input, Row, Space } from "antd";
import { useAtomValue, useSetAtom } from "jotai";
import { stateVault, stateUser } from "@/store/user";
import { queryChallenge, useChangePassword } from "@/services/auth";
import { messageError, messageWarning, messageSuccess } from "@/utils/message";
import { useIsMobile } from "@hopgoldy/cube-ui";
import { SettingContainerProps } from "@/components/setting-container";
import { bytesToHex, hexToBytes } from "@/lib/e2ee/format";
import { sha512 } from "@/utils/crypto";
import {
  deriveMasterKey,
  unwrapDek,
  wrapDek,
  randomBytes,
  SALT_LENGTH,
  ErrorDecryptionFailed,
  ErrorInvalidV2Format,
  ErrorUnsupportedDekVersion,
} from "@/lib/e2ee";
import { useZxcvbnWarning } from "@/utils/password-strength";

export const Content: FC<SettingContainerProps> = (props) => {
  const [form] = Form.useForm();
  const userInfo = useAtomValue(stateUser);
  const vault = useAtomValue(stateVault);
  const setVault = useSetAtom(stateVault);
  const isMobile = useIsMobile();
  const checkStrength = useZxcvbnWarning();
  const [strengthWarning, setStrengthWarning] = useState("");
  const { mutateAsync: postChangePassword, isPending: isChangingPassword } =
    useChangePassword();

  const onSavePassword = async () => {
    const { oldPassword, newPassword, totp = "" } = await form.validateFields();

    // DEK 与 keyBlob 必须已在内存（登录时解出）；
    // re-wrap 语义下新旧派生必须使用库内当前 kdfParams（调优后成本可能变化），
    // 若缺失则显式失败，禁止静默回落默认值导致下次登录永久锁死
    if (!vault.dek || !vault.keyBlob || !vault.salt || !vault.kdfParams) {
      messageError("密钥材料缺失，请重新登录");
      return;
    }

    // ① 本地验旧密码：argon2id(旧密码, salt) → oldKEK → 解 keyBlob
    //    AEAD tag 校验通过即旧密码正确（无需后端参与）；
    //    旧 verifier (oldV) 一并保留，用于提交时的旧密码证明 hash
    let oldKek: Uint8Array | undefined;
    let oldVerifier: Uint8Array | undefined;
    try {
      ({ kek: oldKek, verifier: oldVerifier } = await deriveMasterKey(
        oldPassword,
        hexToBytes(vault.salt),
        vault.kdfParams,
      ));
      await unwrapDek(oldKek, vault.keyBlob);
    } catch (err) {
      if (
        err instanceof ErrorDecryptionFailed ||
        err instanceof ErrorInvalidV2Format ||
        err instanceof ErrorUnsupportedDekVersion
      ) {
        messageWarning("旧密码不正确");
        oldKek?.fill(0);
        oldVerifier?.fill(0);
        return;
      }
      // 非预期异常：清除已派生的密钥材料后再上抛
      oldKek?.fill(0);
      oldVerifier?.fill(0);
      throw err;
    }

    // ② zxcvbn 校验新密码强度（评分 < 3 警告，不拦截）；
    //    懒加载 import + zxcvbn 计算可能抛错，先清除旧密码密钥材料再上抛
    try {
      const warning = await checkStrength(newPassword);
      setStrengthWarning(warning ?? "");
    } catch (err) {
      oldKek.fill(0);
      oldVerifier.fill(0);
      throw err;
    }

    // ③ 新 salt → argon2id → (newKEK, newV)，沿用库内当前 kdfParams（成本不变）
    const newSalt = randomBytes(SALT_LENGTH);
    let newKek: Uint8Array;
    let newVerifier: Uint8Array;
    try {
      ({ kek: newKek, verifier: newVerifier } = await deriveMasterKey(
        newPassword,
        newSalt,
        vault.kdfParams,
      ));
    } catch (err) {
      // 派生失败：同步清除旧密码派生出的密钥材料
      oldKek.fill(0);
      oldVerifier.fill(0);
      throw err;
    }

    // hex 先行取出：④ 覆写 newVerifier 后，⑤ 提交仍需其 hex 形式
    const newVerifierHex = bytesToHex(newVerifier);

    // ④ newKeyBlob = GCM(newKEK, DEK)，DEK 不变，凭证零改动；
    //    wrap 完成后 newKEK/newVerifier 即完成使命，无论成败一律覆写
    let newKeyBlob: string;
    try {
      newKeyBlob = await wrapDek(newKek, vault.dek);
    } finally {
      newKek.fill(0);
      newVerifier.fill(0);
    }

    // ⑤ 提交 re-wrap 结果，后端不销毁 session；请求本身抛错时先清密钥材料再上抛
    let resp: Awaited<ReturnType<typeof postChangePassword>>;
    try {
      const challengeResp = await queryChallenge();
      if (!challengeResp.success) {
        oldKek.fill(0);
        oldVerifier.fill(0);
        newVerifier.fill(0);
        return;
      }

      resp = await postChangePassword({
        verifier: newVerifierHex,
        hash: sha512(bytesToHex(oldVerifier) + challengeResp.data!.code),
        salt: bytesToHex(newSalt),
        keyBlob: newKeyBlob,
        totp: totp || undefined,
      });
    } catch (err) {
      oldKek.fill(0);
      oldVerifier.fill(0);
      newVerifier.fill(0);
      throw err;
    }
    if (resp.code !== 200) {
      oldKek.fill(0);
      oldVerifier.fill(0);
      newVerifier.fill(0);
      return;
    }

    // 保持登录：覆写旧 KEK 后仅更新内存中的 keyBlob/salt（KEK 不留，DEK 不变）；
    // kdfParams 不变（re-wrap 语义），仍是 vault 里的当前值
    oldKek.fill(0);
    oldVerifier.fill(0);
    newVerifier.fill(0);
    setVault({
      dek: vault.dek,
      keyBlob: newKeyBlob,
      salt: bytesToHex(newSalt),
      kdfParams: vault.kdfParams,
    });

    props.onClose();
    messageSuccess("密码修改成功");
  };

  const renderContent = () => {
    return (
      <Form
        form={form}
        labelCol={{ span: 6 }}
        labelAlign="right"
        size={isMobile ? "large" : "middle"}
      >
        <Row className="md:mt-6">
          <Col span={24}>
            <Form.Item
              label="旧密码"
              name="oldPassword"
              rules={[{ required: true, message: "请填写旧密码" }]}
            >
              <Input.Password placeholder="请输入" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="新密码"
              name="newPassword"
              hasFeedback
              rules={[
                { required: true, message: "请填写新密码" },
                { min: 6, message: "密码长度至少6位" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("oldPassword") !== value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error("新旧密码不能相同"));
                  },
                }),
              ]}
            >
              <Input.Password placeholder="请输入" />
            </Form.Item>
          </Col>
          {strengthWarning && (
            <Col span={24}>
              <Alert type="warning" showIcon message={strengthWarning} />
            </Col>
          )}
          <Col span={24}>
            <Form.Item
              label="重复新密码"
              name="confirmPassword"
              rules={[
                { required: true, message: "请重复新密码" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("newPassword") === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error("与新密码不一致"));
                  },
                }),
              ]}
            >
              <Input.Password placeholder="请输入" />
            </Form.Item>
          </Col>
          {userInfo?.withTotp && (
            <Col span={24}>
              <Form.Item
                label="动态验证码"
                name="totp"
                rules={[{ required: true, message: "请输入动态验证码" }]}
              >
                <Input maxLength={6} placeholder="请输入" />
              </Form.Item>
            </Col>
          )}
        </Row>
      </Form>
    );
  };

  if (!isMobile) {
    return (
      <>
        {renderContent()}
        <div className="flex flex-row-reverse">
          <Space>
            <Button onClick={props.onClose}>返回</Button>
            <Button
              type="primary"
              onClick={onSavePassword}
              loading={isChangingPassword}
            >
              保存
            </Button>
          </Space>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4">{renderContent()}</div>
      <div className="p-3 border-t border-gray-200 flex gap-2 justify-end">
        <Button onClick={props.onClose}>返回</Button>
        <Button
          type="primary"
          onClick={onSavePassword}
          loading={isChangingPassword}
        >
          保存
        </Button>
      </div>
    </>
  );
};

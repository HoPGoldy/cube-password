import { FC, useEffect, useState } from "react";
import { Button, Form, Input, Modal, QRCode, Space, Spin } from "antd";
import { useSetAtom, useAtomValue } from "jotai";
import { stateUser, statePasswordSalt } from "@/store/user";
import { sha512 } from "@/utils/crypto";
import { queryChallenge } from "@/services/auth";
import { useOtpQrcode, useBindOtp, useUnbindOtp } from "@/services/otp";
import { messageWarning, messageSuccess } from "@/utils/message";
import { useIsMobile } from "@/layouts/responsive";
import { SettingContainerProps } from "@/components/setting-container";

export const Content: FC<SettingContainerProps> = (props) => {
  const [removeForm] = Form.useForm();
  const isMobile = useIsMobile();
  const setUserInfo = useSetAtom(stateUser);
  const salt = useAtomValue(statePasswordSalt);

  const {
    data: otpInfo,
    isLoading: isLoadingOtpInfo,
    refetch: refetchOtpInfo,
  } = useOtpQrcode();
  const { mutateAsync: bindOtp, isPending: isBinding } = useBindOtp();
  const { mutateAsync: removeOtp, isPending: isRemoving } = useUnbindOtp();

  const [initCode, setInitCode] = useState("");
  const [removeVisible, setRemoveVisible] = useState(false);
  const [isInvalid, setIsInvalid] = useState(false);

  const { registered, qrCode } = otpInfo?.data || {};

  const clearState = () => {
    setInitCode("");
    setRemoveVisible(false);
  };

  useEffect(() => {
    setIsInvalid(false);
    if (!otpInfo || registered) return;
    const invalidTimer = setTimeout(() => setIsInvalid(true), 1000 * 60 * 5);
    return () => clearTimeout(invalidTimer);
  }, [otpInfo]);

  const onSubmit = async () => {
    if (!initCode || initCode.length !== 6) {
      messageWarning("请输入正确的验证码");
      return;
    }
    const resp = await bindOtp(initCode);
    if (resp.code !== 200) return;

    clearState();
    refetchOtpInfo();
    setUserInfo((prev) => (prev ? { ...prev, withTotp: true } : prev));
  };

  const onRemove = async () => {
    const values = await removeForm.validateFields();

    const challengeResp = await queryChallenge();
    if (!challengeResp.success) return;

    const challengeCode = challengeResp.data!.code;
    const hash = sha512(sha512(salt + values.password) + challengeCode);

    const resp = await removeOtp({
      hash,
      challengeCode,
      code: values.removeCode,
    });
    if (resp.code !== 200) return;

    clearState();
    refetchOtpInfo();
    setUserInfo((prev) => (prev ? { ...prev, withTotp: false } : prev));
    messageSuccess("解除绑定成功");
  };

  const onCloseRemoveModal = () => {
    setRemoveVisible(false);
    removeForm.resetFields();
  };

  const renderContent = () => {
    if (isLoadingOtpInfo) {
      return (
        <div className="flex justify-center mt-12">
          <Spin />
        </div>
      );
    }

    if (!registered) {
      return (
        <>
          <div className="w-full flex justify-center flex-col md:flex-row">
            <div className="relative flex justify-center items-center">
              <QRCode
                value={qrCode || "-"}
                status={isInvalid ? "expired" : "active"}
                onRefresh={() => refetchOtpInfo()}
              />
            </div>
            <div className="mt-4 md:ml-4 md:mt-2">
              <div className="cursor-default leading-7">
                请使用谷歌身份验证器扫描二维码，扫描完成后将会以
                <code className="bg-slate-200 dark:bg-slate-600 rounded p-1 overflow-auto mx-2">
                  cube-password(main password)
                </code>
                显示。
              </div>
              <div className="my-2 cursor-default text-slate-500">
                没有身份验证器？
                <a
                  className="text-sky-500"
                  href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2"
                  target="_blank"
                  rel="noreferrer"
                >
                  点此安装
                </a>
              </div>
              <Input
                placeholder="请输入身份验证器提供的 6 位验证码"
                onChange={(e) => setInitCode(e.target.value)}
                value={initCode}
                onKeyUp={(e) => {
                  if (e.key === "Enter") onSubmit();
                }}
              />
            </div>
          </div>

          <div className="w-full text-center text-gray-500 dark:text-gray-400 my-3 cursor-default text-sm">
            绑定后将会在重要操作时要求提供验证码，以保证您的账户安全。
          </div>
        </>
      );
    }

    return (
      <div className="w-full flex justify-center items-center flex-col md:flex-row">
        <div className="text-7xl m-4">🎉</div>
        <div className="w-full">
          <div className="text-center font-bold mb-2 text-green-500">
            令牌验证已启用
          </div>
          <div className="text-center mb-4">
            应用将会在异地登录、修改主密码，重置分组密码时请求令牌验证
          </div>
        </div>
        <Modal
          title="解除绑定确认"
          width={isMobile ? undefined : 300}
          open={removeVisible}
          onCancel={onCloseRemoveModal}
          footer={
            <Space>
              <Button onClick={onCloseRemoveModal}>返回</Button>
              <Button onClick={onRemove} danger loading={isRemoving}>
                解除绑定
              </Button>
            </Space>
          }
        >
          <Form form={removeForm} className="md:pt-6">
            <Form.Item
              name="password"
              label="主密码"
              rules={[{ required: true, message: "请填写主密码" }]}
            >
              <Input.Password placeholder="请输入" />
            </Form.Item>
            <Form.Item
              name="removeCode"
              label="验证码"
              rules={[
                { required: true, message: "请填写验证码" },
                { pattern: /^\d{6}$/, message: "验证码长度为 6 位" },
              ]}
            >
              <Input placeholder="请输入 6 位验证码" />
            </Form.Item>
          </Form>

          <div className="mb-6 text-slate-500 text-center dark:text-slate-300">
            解除绑定会降低安全性，请谨慎操作。
          </div>
        </Modal>
      </div>
    );
  };

  if (!isMobile) {
    return (
      <>
        {renderContent()}
        <div className="flex flex-row-reverse">
          <Space>
            <Button onClick={props.onClose}>返回</Button>
            {registered ? (
              <Button onClick={() => setRemoveVisible(true)}>解除绑定</Button>
            ) : (
              <Button type="primary" onClick={onSubmit} loading={isBinding}>
                绑定
              </Button>
            )}
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
        {registered ? (
          <Button onClick={() => setRemoveVisible(true)}>解除绑定</Button>
        ) : (
          <Button type="primary" onClick={onSubmit} loading={isBinding}>
            绑定
          </Button>
        )}
      </div>
    </>
  );
};

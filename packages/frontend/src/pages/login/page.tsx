import { Alert, Button, Col, Input, InputRef, Row, Typography } from "antd";
import { useEffect, useRef, useState } from "react";
import { useLogin, queryChallenge } from "../../services/auth";
import { login, stateVault, stateKdfMeta } from "../../store/user";
import { messageError } from "@/utils/message";
import { showGlobalMessage } from "@/utils/message";
import {
  ErrorGateDenied,
  toGateDenial,
  withGateToken,
} from "@/services/device-gate";
import type { GateDenial } from "@/services/device-gate";
import { KeyOutlined } from "@ant-design/icons";
import { useLoginSuccess } from "./use-login-success";
import { APP_NAME, APP_SUBTITLE } from "@/config";
import { usePageTitle } from "@/store/global";
import { useSetAtom, useAtomValue } from "jotai";
import { bytesToHex, hexToBytes } from "@/lib/e2ee/format";
import { sha512 } from "@/utils/crypto";
import {
  deriveMasterKey,
  unwrapDek,
  parseKdfParams,
  ErrorInvalidKdfParams,
  ErrorDecryptionFailed,
  ErrorInvalidV2Format,
} from "@/lib/e2ee";
import type {
  SchemaLockDetailType,
  SchemaLoginFailRecordType,
} from "@shared-types/auth";
import dayjs from "dayjs";

interface LoginPageProps {
  initialLockDetail?: SchemaLockDetailType;
  /** 提交时过门被拒（如停留期间钥匙被吊销）：上报外层渲染未授权页（密码不发送） */
  onGateDenied: (denial: GateDenial) => void;
}

export const LoginPage = ({
  initialLockDetail,
  onGateDenied,
}: LoginPageProps) => {
  usePageTitle("登录");
  const [password, setPassword] = useState("");
  const [lockDetail, setLockDetail] = useState<
    SchemaLockDetailType | undefined
  >(initialLockDetail);
  const [deriving, setDeriving] = useState(false);
  const passwordInputRef = useRef<InputRef>(null);
  const { mutateAsync: postLogin, isPending: isLogin } = useLogin();
  const setVault = useSetAtom(stateVault);
  const kdfMeta = useAtomValue(stateKdfMeta);

  const { runLoginSuccess } = useLoginSuccess();

  useEffect(() => {
    if (initialLockDetail) setLockDetail(initialLockDetail);
  }, [initialLockDetail]);

  const onPasswordSubmit = async () => {
    if (!password) {
      messageError("请输入密码");
      passwordInputRef.current?.focus();
      return;
    }
    if (!kdfMeta.salt) {
      messageError("盐值缺失，请刷新页面重试");
      return;
    }
    // 解析并校验后端下发的 kdfParams（JSON 非法 / 算法或版本不识别时显式报错，
    // 禁止静默回落默认值，否则会派生出与库内 V 不一致的密钥）
    if (!kdfMeta.kdfParamsRaw) {
      messageError("KDF 参数缺失，请刷新页面重试");
      return;
    }
    let kdfParams;
    try {
      kdfParams = parseKdfParams(kdfMeta.kdfParamsRaw);
    } catch (err) {
      const detail =
        err instanceof ErrorInvalidKdfParams
          ? err.message
          : `未知错误：${err instanceof Error ? err.message : String(err)}`;
      messageError(`KDF 参数校验失败，无法登录：${detail}`);
      return;
    }

    // 1. 本地派生 (KEK, V)，约 0.5s，按钮显示"密钥派生中"
    setDeriving(true);
    let kek: Uint8Array;
    let verifier: Uint8Array;
    try {
      ({ kek, verifier } = await deriveMasterKey(
        password,
        hexToBytes(kdfMeta.salt),
        kdfParams,
      ));
    } catch (err) {
      setDeriving(false);
      messageError(
        `密钥派生失败：${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }

    // 2. 过门现取临时 token（新挑战码新签名）→ 取挑战码并计算登录 hash → 登录，
    // 全程在同一 withGateToken 调用栈内（token 用完即弃）；finally 确保任何异常
    // 路径都会结束 deriving 状态，密钥材料在每条失败路径上清零（时序不得破坏）
    let resp: Awaited<ReturnType<typeof postLogin>> | undefined;
    try {
      resp = await withGateToken(async (gateToken) => {
        const challengeResp = await queryChallenge({ gateToken });
        if (!challengeResp.success) {
          kek.fill(0);
          verifier.fill(0);
          return undefined;
        }

        const challengeCode = challengeResp.data!.code;
        // hash = SHA512(hex(V) + challengeCode)，与后端比对逻辑一致
        const hash = sha512(bytesToHex(verifier) + challengeCode);

        return postLogin({ hash, gateToken });
      });
    } catch (err) {
      // 过门/挑战/登录请求抛错（钥匙被吊销、网络异常等）：清除已派生的密钥材料
      kek.fill(0);
      verifier.fill(0);
      // 过门被拒（ErrorGateDenied）：上报外层渲染未授权页，
      // 密码请求未发出（挑战/登录未执行）
      if (err instanceof ErrorGateDenied) {
        onGateDenied(toGateDenial(err));
        return;
      }
      throw err;
    } finally {
      setDeriving(false);
    }

    // 挑战码申请失败（success=false，如账号被锁）：静默中止，密钥材料已清零
    if (!resp) return;

    if (resp.code !== 200) {
      // 登录失败，清除已派生的密钥材料，更新锁定信息
      kek.fill(0);
      verifier.fill(0);
      if (resp.lockDetail) {
        setLockDetail(resp.lockDetail);
      }
      if (resp.message) {
        showGlobalMessage("warning", resp.message);
      }
      return;
    }

    // 3. KEK 解开 keyBlob 得到 DEK（AEAD tag 校验 = 第二重密码确认）
    let dek: Uint8Array;
    try {
      dek = await unwrapDek(kek, resp.data!.keyBlob);
    } catch (err) {
      kek.fill(0);
      verifier.fill(0);
      if (
        err instanceof ErrorDecryptionFailed ||
        err instanceof ErrorInvalidV2Format
      ) {
        messageError(
          "密钥校验失败：主密码可能不正确或数据已被篡改，请重新登录",
        );
      } else {
        messageError(
          `密钥解包失败：${err instanceof Error ? err.message : String(err)}`,
        );
      }
      return;
    }

    // KEK/verifier 已完成使命，覆写后丢弃，内存中只留 DEK
    kek.fill(0);
    verifier.fill(0);
    // vault.kdfParams 以 login 响应为准（版本化闭环），
    // 响应中的参数必须与登录派生所用的参数一致，否则拒绝进入
    let loginKdfParams;
    try {
      loginKdfParams = parseKdfParams(resp.data!.kdfParams);
    } catch (err) {
      const detail =
        err instanceof ErrorInvalidKdfParams
          ? err.message
          : `未知错误：${err instanceof Error ? err.message : String(err)}`;
      messageError(`登录响应的 KDF 参数校验失败：${detail}`);
      return;
    }
    if (
      loginKdfParams.m !== kdfParams.m ||
      loginKdfParams.t !== kdfParams.t ||
      loginKdfParams.p !== kdfParams.p
    ) {
      messageError(
        "登录响应的 KDF 参数与登录前不一致，可能存在数据异常，请刷新页面重试",
      );
      return;
    }
    setVault({
      dek,
      keyBlob: resp.data!.keyBlob,
      salt: resp.data!.salt,
      kdfParams: loginKdfParams,
    });
    login(resp.data!);
    runLoginSuccess();
  };

  const onPasswordInputKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") onPasswordSubmit();
  };

  const appTitle = APP_NAME;
  const appSubTitle = APP_SUBTITLE;

  const renderLoginFailure = (item: SchemaLoginFailRecordType) => {
    const message =
      dayjs(item.date).format("YYYY-MM-DD HH:mm:ss") +
      " 于 " +
      item.ip +
      " 登录失败";
    return (
      <Col span={24} key={item.date}>
        <Alert message={message} type="error" showIcon />
      </Col>
    );
  };

  const renderLockResult = () => {
    return (
      <div>
        <Typography.Title
          level={2}
          className="text-center !text-red-500"
          data-testid="login-locked-title"
        >
          登录已锁定
        </Typography.Title>
        <Typography.Paragraph className="text-center !text-red-500">
          由于登录失败次数超过上限，应用访问功能已被锁定，请重启应用服务或明天再试。
        </Typography.Paragraph>
      </div>
    );
  };

  const renderLoginForm = () => {
    return (
      <>
        <Input.Password
          size="large"
          className="mb-2"
          ref={passwordInputRef}
          autoFocus
          placeholder="请输入密码"
          prefix={<KeyOutlined />}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyUp={onPasswordInputKeyUp}
          data-testid="login-password-input"
        />

        <Button
          size="large"
          block
          loading={isLogin || deriving}
          type="primary"
          onClick={onPasswordSubmit}
          data-testid="login-submit-btn"
        >
          {deriving ? "密钥派生中" : "登 录"}
        </Button>
      </>
    );
  };

  return (
    <div className="h-screen w-screen bg-gray-100 dark:bg-neutral-800 flex flex-col justify-center items-center dark:text-gray-100">
      <header className="w-screen text-center min-h-[236px]">
        <div className="text-5xl font-bold text-mainColor dark:text-neutral-200">
          {appTitle}
        </div>
        <div className="mt-4 text-xl text-mainColor dark:text-neutral-300">
          {appSubTitle}
        </div>
        <div className="w-[70%] my-6 mx-auto">
          <Row gutter={[12, 12]}>
            {lockDetail?.loginFailure?.map(renderLoginFailure)}
          </Row>
        </div>
      </header>
      <div className="w-[70%] md:w-[40%] lg:w-[30%] xl:w-[20%] flex flex-col items-center">
        {lockDetail?.isBanned ? renderLockResult() : renderLoginForm()}
      </div>
    </div>
  );
};

import { sha512 } from "@/utils/crypto";
import { getAesMeta } from "@/utils/crypto";
import { Alert, Button, Col, Input, InputRef, Row, Typography } from "antd";
import { useEffect, useRef, useState } from "react";
import { useLogin, queryChallenge } from "../../services/auth";
import { login, stateMainPwd, statePasswordSalt } from "../../store/user";
import { messageError } from "@/utils/message";
import { showGlobalMessage } from "@/utils/message";
import { KeyOutlined } from "@ant-design/icons";
import { useLoginSuccess } from "./use-login-success";
import { APP_NAME, APP_SUBTITLE, THEME_BUTTON_COLOR } from "@/config";
import { usePageTitle } from "@/store/global";
import { useSetAtom, useAtomValue } from "jotai";
import type { LockDetail, LoginFailRecord } from "@/types/auth";
import dayjs from "dayjs";

interface LoginPageProps {
  initialLockDetail?: LockDetail;
}

export const LoginPage = ({ initialLockDetail }: LoginPageProps) => {
  usePageTitle("登录");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeVisible, setCodeVisible] = useState(false);
  const [lockDetail, setLockDetail] = useState<LockDetail | undefined>(
    initialLockDetail,
  );
  const passwordInputRef = useRef<InputRef>(null);
  const codeInputRef = useRef<InputRef>(null);
  const { mutateAsync: postLogin, isPending: isLogin } = useLogin();
  const setMainPwd = useSetAtom(stateMainPwd);
  const salt = useAtomValue(statePasswordSalt);

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

    // 1. fetch challenge code
    const challengeResp = await queryChallenge();
    if (!challengeResp.success) return;

    const challengeCode = challengeResp.data!.code;
    // hash = SHA512(SHA512(salt + password) + challengeCode)
    const hash = sha512(sha512(salt + password) + challengeCode);

    const resp = await postLogin({
      hash,
      code: code || undefined,
    });

    if (resp?.code === 40103) {
      // need TOTP code
      setCodeVisible(true);
      setTimeout(() => codeInputRef.current?.focus(), 100);
      return;
    }

    if (resp?.code !== 200) {
      // 登录失败，更新锁定信息
      if (resp?.lockDetail) {
        setLockDetail(resp.lockDetail);
      }
      if (resp?.message) {
        showGlobalMessage("warning", resp.message);
      }
      return;
    }

    // save AES meta for client-side encryption
    const { key, iv } = getAesMeta(password);
    setMainPwd({ pwdKey: key, pwdIv: iv });

    login(resp.data);
    runLoginSuccess();
  };

  const onPasswordInputKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") onPasswordSubmit();
  };

  const appTitle = APP_NAME;
  const appSubTitle = APP_SUBTITLE;

  const renderLoginFailure = (item: LoginFailRecord) => {
    const message =
      dayjs(item.date).format("YYYY-MM-DD HH:mm:ss") +
      " 于 " +
      item.location +
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

        {codeVisible && (
          <Input
            size="large"
            className="mb-2"
            ref={codeInputRef}
            placeholder="请输入动态验证码"
            prefix={<KeyOutlined />}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyUp={onPasswordInputKeyUp}
            data-testid="login-code-input"
          />
        )}

        <Button
          size="large"
          block
          loading={isLogin}
          type="primary"
          style={{ background: THEME_BUTTON_COLOR }}
          onClick={onPasswordSubmit}
          data-testid="login-submit-btn"
        >
          登 录
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

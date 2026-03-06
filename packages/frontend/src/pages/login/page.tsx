import { sha512 } from "@/utils/crypto";
import { getAesMeta } from "@/utils/crypto";
import { Button, Input, InputRef } from "antd";
import { useRef, useState } from "react";
import { useLogin, queryChallenge } from "../../services/auth";
import { login, stateMainPwd } from "../../store/user";
import { messageError } from "@/utils/message";
import { KeyOutlined } from "@ant-design/icons";
import { useLoginSuccess } from "./use-login-success";
import { THEME_BUTTON_COLOR } from "@/config";
import { usePageTitle } from "@/store/global";
import { useSetAtom } from "jotai";

export const LoginPage = () => {
  usePageTitle("登录");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeVisible, setCodeVisible] = useState(false);
  const passwordInputRef = useRef<InputRef>(null);
  const codeInputRef = useRef<InputRef>(null);
  const { mutateAsync: postLogin, isPending: isLogin } = useLogin();
  const setMainPwd = useSetAtom(stateMainPwd);

  const { runLoginSuccess } = useLoginSuccess();

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
    // 2. hash = SHA512(password + challengeCode)
    const hash = sha512(password + challengeCode);

    const resp = await postLogin({
      hash,
      challengeCode,
      code: code || undefined,
    });

    if (resp?.code === 40103) {
      // need TOTP code
      setCodeVisible(true);
      setTimeout(() => codeInputRef.current?.focus(), 100);
      return;
    }

    if (resp?.code !== 200) return;

    // save AES meta for client-side encryption
    const { key, iv } = getAesMeta(password);
    setMainPwd({ pwdKey: key, pwdIv: iv });

    login(resp.data);
    runLoginSuccess();
  };

  const onPasswordInputKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") onPasswordSubmit();
  };

  const appTitle = "Cube Password";
  const appSubTitle = "安全可靠的密码管理器";

  return (
    <div className="h-screen w-screen bg-gray-100 dark:bg-neutral-800 flex flex-col justify-center items-center dark:text-gray-100">
      <header className="w-screen text-center min-h-[236px]">
        <div className="text-5xl font-bold text-mainColor dark:text-neutral-200">
          {appTitle}
        </div>
        <div className="mt-4 text-xl text-mainColor dark:text-neutral-300">
          {appSubTitle}
        </div>
      </header>
      <div className="w-[70%] md:w-[40%] lg:w-[30%] xl:w-[20%] flex flex-col items-center">
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
      </div>
    </div>
  );
};

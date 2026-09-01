import { useRef, useState } from "react";
import { Alert, Button, Input, InputRef, Row, Col } from "antd";
import { useInit } from "@/services/auth";
import { messageError, messageSuccess } from "@/utils/message";
import { usePageTitle } from "@/store/global";
import { bytesToHex } from "@/lib/e2ee/format";
import {
  randomBytes,
  deriveMasterKey,
  wrapDek,
  DEFAULT_KDF_PARAMS,
  SALT_LENGTH,
} from "@/lib/e2ee";
import { useZxcvbnWarning } from "@/utils/password-strength";

const getViewWidth = () => {
  const width = window.innerWidth;
  const isMobile = width < 768;
  return isMobile ? width * 0.8 + "px" : Math.min(width * 0.45, 560) + "px";
};

const viewWidth = getViewWidth();

const Init = () => {
  usePageTitle("应用初始化");

  const [swiperIndex, setSwiperIndex] = useState(0);
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [strengthWarning, setStrengthWarning] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const passwordInputRef = useRef<InputRef>(null);
  const repeatPasswordInputRef = useRef<InputRef>(null);
  const { mutateAsync: postInit, isPending: isCreating } = useInit();
  const checkStrength = useZxcvbnWarning();

  const onInputedPassword = async () => {
    if (password.length < 6) {
      messageError("密码长度应大于 6 位");
      passwordInputRef.current?.focus();
      return;
    }
    // zxcvbn 懒加载强度提示（评分 < 3 警告，不拦截）
    const warning = await checkStrength(password);
    setStrengthWarning(warning ?? "");
    setSwiperIndex(1);
    setTimeout(() => repeatPasswordInputRef.current?.focus(), 600);
  };

  const onInputedRepeatPassword = () => {
    if (repeatPassword !== password) {
      messageError("两次密码不一致");
      repeatPasswordInputRef.current?.focus();
      return;
    }
    setSwiperIndex(2);
  };

  const onSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // salt 前端生成 → argon2id 派生 (KEK, V) → 随机 DEK 用 KEK 包裹为 keyBlob
      const salt = randomBytes(SALT_LENGTH);
      const { kek, verifier } = await deriveMasterKey(
        password,
        salt,
        DEFAULT_KDF_PARAMS,
      );
      const dek = randomBytes(32);
      const keyBlob = await wrapDek(kek, dek);

      const resp = await postInit({
        verifier: bytesToHex(verifier),
        salt: bytesToHex(salt),
        keyBlob,
        kdfParams: JSON.stringify(DEFAULT_KDF_PARAMS),
      });
      if (resp?.code !== 200) return;

      messageSuccess("初始化完成");
      window.location.href = "/login";
    } finally {
      setSubmitting(false);
    }
  };

  const getViewStyle = (index: number): React.CSSProperties => ({
    width: viewWidth,
    display: "inline-block",
    verticalAlign: "top",
    opacity: swiperIndex === index ? 1 : 0,
  });

  return (
    <div className="h-screen w-screen bg-gray-100 dark:bg-neutral-800 flex flex-col flex-nowrap items-center dark:text-gray-100">
      <header className="text-5xl font-bold text-mainColor dark:text-neutral-200 mt-36 w-full text-center">
        应用初始化
      </header>
      <div className="overflow-hidden mt-4" style={{ width: viewWidth }}>
        <div
          className="transition-all"
          style={{
            width: `calc(${viewWidth} * 4)`,
            transform: `translate(calc(-${viewWidth} * ${swiperIndex}))`,
          }}
        >
          <div style={getViewStyle(0)}>
            <div className="text-center text-xl mb-16">
              设置主密码
              <div className="text-slate-600 dark:text-slate-400 text-base mt-6">
                主密码是访问应用的唯一凭证，请设置一个至少 6
                位的强密码，并牢记在心。
                <br />
                不要使用生日、姓名缩写等常见信息。
              </div>
            </div>
            <Row gutter={[8, 8]} justify="center">
              <Col span={17}>
                <Input.Password
                  ref={passwordInputRef}
                  size="large"
                  autoFocus
                  placeholder="请输入密码"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (repeatPassword) setRepeatPassword("");
                    if (strengthWarning) setStrengthWarning("");
                  }}
                  onKeyUp={(e) => e.key === "Enter" && onInputedPassword()}
                  data-testid="init-password-input"
                />
              </Col>
              <Col span={7} xl={5} xxl={4}>
                <Button
                  disabled={!password || isCreating}
                  type="primary"
                  block
                  size="large"
                  onClick={onInputedPassword}
                >
                  下一步
                </Button>
              </Col>
            </Row>
            {strengthWarning && (
              <Row justify="center" className="mt-4">
                <Col span={24}>
                  <Alert type="warning" showIcon message={strengthWarning} />
                </Col>
              </Row>
            )}
          </div>
          <div style={getViewStyle(1)}>
            <div className="text-center text-xl mb-16">
              重复密码
              <div className="text-slate-600 dark:text-slate-400 text-base mt-6">
                隐私数据将使用该密码加密。因此，主密码一旦丢失，所有的数据都将{" "}
                <b>无法找回</b>。
              </div>
            </div>
            <Row gutter={[8, 8]} justify="center">
              <Col span={17}>
                <Input.Password
                  ref={repeatPasswordInputRef}
                  size="large"
                  placeholder="重复密码"
                  autoComplete="new-password"
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                  onKeyUp={(e) =>
                    e.key === "Enter" && onInputedRepeatPassword()
                  }
                  data-testid="init-repeat-password-input"
                />
              </Col>
              <Col span={7} xl={5} xxl={4}>
                <Button
                  disabled={!repeatPassword || isCreating}
                  type="primary"
                  block
                  size="large"
                  onClick={onInputedRepeatPassword}
                >
                  下一步
                </Button>
              </Col>
            </Row>
            <Row justify="center" className="mt-2">
              <Col span={4}>
                <Button block onClick={() => setSwiperIndex(0)} type="text">
                  返回
                </Button>
              </Col>
            </Row>
          </div>
          <div style={getViewStyle(2)}>
            <div className="text-center text-xl mb-16">
              告知
              <div className="text-slate-600 dark:text-slate-400 text-base mt-6">
                本应用不会在任何地方使用、分析或明文存储你的信息。
                <br />
                你可以使用浏览器的隐私模式进行访问来提高安全性。
                <br />
                该页面不会再次出现，请确保 <b>主密码已可靠保存</b>{" "}
                后点击下方按钮。
              </div>
            </div>
            <Row gutter={[8, 8]} justify="center">
              <Col span={17}>
                <Button
                  loading={submitting || isCreating}
                  type="primary"
                  block
                  size="large"
                  onClick={onSubmit}
                  data-testid="init-submit-btn"
                >
                  完成初始化
                </Button>
              </Col>
            </Row>
            <Row justify="center" className="mt-2">
              <Col span={4}>
                <Button block onClick={() => setSwiperIndex(1)} type="text">
                  返回
                </Button>
              </Col>
            </Row>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Init;

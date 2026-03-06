import { useRef, useState } from "react";
import { Button, Input, InputRef, Row, Col } from "antd";
import { KeyOutlined } from "@ant-design/icons";
import { useInit } from "@/services/auth";
import { messageError, messageSuccess } from "@/utils/message";
import { usePageTitle } from "@/store/global";
import { THEME_BUTTON_COLOR } from "@/config";
import bcrypt from "bcryptjs";

const Init = () => {
  usePageTitle("应用初始化");

  const [step, setStep] = useState(0);
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const passwordInputRef = useRef<InputRef>(null);
  const repeatPasswordInputRef = useRef<InputRef>(null);
  const { mutateAsync: postInit, isPending: isCreating } = useInit();

  const onInputedPassword = () => {
    if (password.length < 6) {
      messageError("密码长度应大于 6 位");
      passwordInputRef.current?.focus();
      return;
    }
    setStep(1);
    setTimeout(() => repeatPasswordInputRef.current?.focus(), 100);
  };

  const onInputedRepeatPassword = () => {
    if (repeatPassword !== password) {
      messageError("两次密码不一致");
      repeatPasswordInputRef.current?.focus();
      return;
    }
    setStep(2);
  };

  const onSubmit = async () => {
    const passwordHash = bcrypt.hashSync(password, 10);
    const resp = await postInit({ passwordHash });
    if (resp?.code !== 200) return;

    messageSuccess("初始化完成");
    window.location.href = "/login";
  };

  return (
    <div className="h-screen w-screen bg-gray-100 dark:bg-neutral-800 flex flex-col items-center dark:text-gray-100">
      <header className="text-5xl font-bold text-mainColor dark:text-neutral-200 mt-36 w-full text-center">
        应用初始化
      </header>

      <div className="w-[70%] md:w-[40%] lg:w-[30%] xl:w-[20%] mt-8">
        {step === 0 && (
          <div>
            <div className="text-center mb-4">
              <div className="text-lg font-semibold mb-2">设置主密码</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                主密码是访问应用的唯一凭证，请设置一个至少 6
                位的强密码，并牢记在心。
              </div>
            </div>
            <Row gutter={[8, 8]}>
              <Col flex="auto">
                <Input.Password
                  ref={passwordInputRef}
                  size="large"
                  autoFocus
                  placeholder="请输入密码"
                  prefix={<KeyOutlined />}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={(e) => e.key === "Enter" && onInputedPassword()}
                  data-testid="init-password-input"
                />
              </Col>
              <Col>
                <Button
                  size="large"
                  type="primary"
                  style={{ background: THEME_BUTTON_COLOR }}
                  disabled={!password}
                  onClick={onInputedPassword}
                >
                  下一步
                </Button>
              </Col>
            </Row>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="text-center mb-4">
              <div className="text-lg font-semibold mb-2">重复密码</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                隐私数据将使用该密码加密。主密码一旦丢失，所有的数据都将
                <b>无法找回</b>。
              </div>
            </div>
            <Row gutter={[8, 8]}>
              <Col flex="auto">
                <Input.Password
                  ref={repeatPasswordInputRef}
                  size="large"
                  placeholder="重复密码"
                  prefix={<KeyOutlined />}
                  autoComplete="new-password"
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                  onKeyUp={(e) =>
                    e.key === "Enter" && onInputedRepeatPassword()
                  }
                  data-testid="init-repeat-password-input"
                />
              </Col>
              <Col>
                <Button
                  size="large"
                  type="primary"
                  style={{ background: THEME_BUTTON_COLOR }}
                  disabled={!repeatPassword}
                  onClick={onInputedRepeatPassword}
                >
                  下一步
                </Button>
              </Col>
            </Row>
            <div className="text-center mt-3">
              <Button type="text" onClick={() => setStep(0)}>
                返回
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="text-center mb-4">
              <div className="text-lg font-semibold mb-2">告知</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                本应用不会在任何地方使用、分析或明文存储你的信息。
                <br />
                你可以使用浏览器的隐私模式进行访问来提高安全性。
                <br />
                该页面不会再次出现，请确保 <b>主密码已可靠保存</b>{" "}
                后点击下方按钮。
              </div>
            </div>
            <Button
              size="large"
              block
              type="primary"
              loading={isCreating}
              style={{ background: THEME_BUTTON_COLOR }}
              onClick={onSubmit}
              data-testid="init-submit-btn"
            >
              完成初始化
            </Button>
            <div className="text-center mt-3">
              <Button type="text" onClick={() => setStep(1)}>
                返回
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Init;

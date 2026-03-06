import { FC, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Statistic,
  Switch,
  message,
} from "antd";
import {
  LeftOutlined,
  KeyOutlined,
  LockOutlined,
  FormOutlined,
  DatabaseOutlined,
  SmileOutlined,
  SnippetsOutlined,
  HighlightOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { useAtomValue, useSetAtom } from "jotai";
import { stateUser, changeTheme, logout, type AppTheme } from "@/store/user";
import {
  useSetTheme,
  useStatistic,
  useUpdateCreatePwdSetting,
} from "@/services/user";
import { useLogout } from "@/services/auth";
import { usePageTitle } from "@/store/global";
import { Cell, SplitLine } from "@/components/cell";

const DEFAULT_PASSWORD_ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
const DEFAULT_PASSWORD_LENGTH = 16;

const SettingPage: FC = () => {
  usePageTitle("设置");
  const navigate = useNavigate();
  const userInfo = useAtomValue(stateUser);
  const setUserInfo = useSetAtom(stateUser);
  const { mutateAsync: setAppTheme } = useSetTheme();
  const { mutateAsync: postLogout } = useLogout();
  const { mutateAsync: fetchStatistic } = useStatistic();
  const { mutateAsync: updatePwdSetting, isPending: isSavingPwd } =
    useUpdateCreatePwdSetting();
  const [form] = Form.useForm();
  const [showPwdSetting, setShowPwdSetting] = useState(false);
  const [stat, setStat] = useState<{
    groupCount: number;
    certificateCount: number;
  } | null>(null);

  useEffect(() => {
    fetchStatistic().then((res) => {
      if (res.code === 200) setStat(res.data);
    });
  }, []);

  const onSwitchTheme = () => {
    const newTheme: AppTheme = userInfo?.theme === "dark" ? "light" : "dark";
    setAppTheme({ theme: newTheme });
    changeTheme(newTheme);
  };

  const onLogout = async () => {
    await postLogout();
    logout();
  };

  const onSavePwdSetting = async () => {
    const values = await form.validateFields();
    const resp = await updatePwdSetting({
      createPwdAlphabet: values.pwdAlphabet,
      createPwdLength: values.pwdLength,
    });
    if (resp.code !== 200) return;
    message.success("密码生成规则已更新");
    setUserInfo((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        createPwdAlphabet: values.pwdAlphabet,
        createPwdLength: values.pwdLength,
      };
    });
    setShowPwdSetting(false);
  };

  const onResetPwdSetting = async () => {
    const resp = await updatePwdSetting({
      createPwdAlphabet: DEFAULT_PASSWORD_ALPHABET,
      createPwdLength: DEFAULT_PASSWORD_LENGTH,
    });
    if (resp.code !== 200) return;
    message.success("密码生成规则已重置");
    setUserInfo((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        createPwdAlphabet: DEFAULT_PASSWORD_ALPHABET,
        createPwdLength: DEFAULT_PASSWORD_LENGTH,
      };
    });
    setShowPwdSetting(false);
  };

  const menuItems = [
    {
      label: "修改密码",
      icon: <KeyOutlined />,
      onClick: () => navigate("/change-password"),
    },
    {
      label: "动态验证码",
      icon: <LockOutlined />,
      onClick: () => navigate("/otp-config"),
    },
    {
      label: "密码生成规则",
      icon: <FormOutlined />,
      onClick: () => setShowPwdSetting((v) => !v),
    },
    {
      label: "安全日志",
      icon: <DatabaseOutlined />,
      onClick: () => navigate("/security-log"),
    },
    {
      label: "关于",
      icon: <SmileOutlined />,
      onClick: () => navigate("/about"),
    },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center p-3 border-b border-gray-200">
        <Button
          icon={<LeftOutlined />}
          type="text"
          onClick={() => navigate("/certificates")}
        />
        <span className="ml-2 text-lg font-medium">设置</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Statistics */}
        <Card size="small" className="mb-4">
          <Row justify="space-around">
            <Col>
              <Statistic
                title="分组数量"
                value={stat?.groupCount ?? "---"}
                prefix={<SnippetsOutlined />}
              />
            </Col>
            <Col>
              <Statistic
                title="凭证数量"
                value={stat?.certificateCount ?? "---"}
                prefix={<HighlightOutlined />}
              />
            </Col>
          </Row>
        </Card>

        {/* Theme */}
        <Card size="small" className="mb-4">
          <div className="flex justify-between items-center">
            <span>黑夜模式</span>
            <Switch
              checkedChildren="开启"
              unCheckedChildren="关闭"
              checked={userInfo?.theme === "dark"}
              onChange={onSwitchTheme}
            />
          </div>
        </Card>

        {/* Menu */}
        <Card
          size="small"
          className="mb-4"
          styles={{ body: { padding: "0px 18px" } }}
        >
          {menuItems.map((item, index) => (
            <div key={item.label}>
              <Cell
                title={
                  <div>
                    {item.icon} &nbsp;{item.label}
                  </div>
                }
                onClick={item.onClick}
              />
              {index !== menuItems.length - 1 && <SplitLine />}
            </div>
          ))}
        </Card>

        {/* Password Generator Setting (inline expand) */}
        {showPwdSetting && (
          <Card size="small" className="mb-4" title="密码生成规则">
            <Form
              form={form}
              layout="vertical"
              initialValues={{
                pwdAlphabet:
                  userInfo?.createPwdAlphabet || DEFAULT_PASSWORD_ALPHABET,
                pwdLength: userInfo?.createPwdLength || DEFAULT_PASSWORD_LENGTH,
              }}
            >
              <Form.Item
                label="密码字符集"
                name="pwdAlphabet"
                rules={[{ required: true, message: "请填写字符集" }]}
              >
                <Input placeholder="请填写字符集" />
              </Form.Item>
              <Form.Item
                label="密码长度"
                name="pwdLength"
                rules={[{ required: true, message: "请填写密码长度" }]}
              >
                <InputNumber
                  precision={0}
                  min={4}
                  max={128}
                  placeholder="请填写密码长度"
                  className="w-full"
                />
              </Form.Item>
              <div className="flex gap-2 justify-end">
                <Button onClick={onResetPwdSetting}>重置默认</Button>
                <Button
                  type="primary"
                  onClick={onSavePwdSetting}
                  loading={isSavingPwd}
                >
                  保存
                </Button>
              </div>
            </Form>
          </Card>
        )}

        {/* Logout */}
        <Button
          block
          danger
          size="large"
          icon={<LogoutOutlined />}
          onClick={onLogout}
        >
          登出
        </Button>
      </div>
    </div>
  );
};

export default SettingPage;

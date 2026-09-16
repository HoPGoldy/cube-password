import { FC, useState } from "react";
import { Alert, Button, Card, Input, Space, Spin, Typography } from "antd";
import {
  CopyOutlined,
  ReloadOutlined,
  SafetyOutlined,
  StopOutlined,
} from "@ant-design/icons";
import copy from "copy-to-clipboard";
import { generateDeviceKeyPair, suggestDeviceName } from "@/lib/device-key";
import { messageError, messageSuccess } from "@/utils/message";
import type { GateDenial } from "@/services/device-gate";
import { APP_NAME, APP_SUBTITLE } from "@/config";

const { Text, Title, Paragraph } = Typography;

/**
 * 登录页门禁 UI（见 docs/plans/device-gate/tasks/04-login-gate-flow.md）：
 * - 门激活且静默过门失败 → 「此设备未授权」页：不再显示密码表单（密码请求此时也过不了门禁），
 *   附「如何绑定」指引 + 内嵌钥匙串生成流程 + 「重新验证」入口（重跑 passGate，无需手动刷新）
 * - 门禁流程暂时不可用（网络/非安全上下文等）→ 文案区分、同样提供重试
 */

/** 生成钥匙串并展示（纯浏览器本地，私钥不出本机密钥库） */
const KeyGenCard: FC = () => {
  const [deviceName, setDeviceName] = useState(suggestDeviceName());
  const [deviceKey, setDeviceKey] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const onGenerate = async () => {
    const name = deviceName.trim();
    if (!name) {
      messageError("请输入设备名称");
      return;
    }
    setGenerating(true);
    try {
      const { deviceKey } = await generateDeviceKeyPair(name);
      setDeviceKey(deviceKey);
      messageSuccess("本机钥匙已生成");
    } catch (err) {
      messageError(`钥匙生成失败：${(err as Error).message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card size="small" type="inner" title="生成本机钥匙串" className="mb-4">
      <Space.Compact className="w-full mb-3">
        <Input
          placeholder="设备名称，如 Chrome on macOS"
          value={deviceName}
          maxLength={50}
          onChange={(e) => setDeviceName(e.target.value)}
          onPressEnter={onGenerate}
        />
        <Button type="primary" loading={generating} onClick={onGenerate}>
          生成
        </Button>
      </Space.Compact>
      {deviceKey && (
        <>
          <Space.Compact className="w-full">
            <Input readOnly value={deviceKey} />
            <Button
              icon={<CopyOutlined />}
              onClick={() => {
                copy(deviceKey);
                messageSuccess("钥匙串已复制");
              }}
            >
              复制
            </Button>
          </Space.Compact>
          <Paragraph
            type="secondary"
            className="mt-3 mb-0"
            style={{ fontSize: 12 }}
          >
            私钥仅存在于本机浏览器密钥库，服务器与钥匙串本身均不含私钥。
          </Paragraph>
        </>
      )}
    </Card>
  );
};

export interface DeviceGatePageProps {
  /** 门禁失败信息（kind 区分未授权 / 暂时不可用） */
  denial: GateDenial;
}

export const DeviceGatePage: FC<DeviceGatePageProps> = ({ denial }) => {
  const unauthorized = denial.kind === "unauthorized";

  return (
    <div className="h-screen w-screen bg-gray-100 dark:bg-neutral-800 flex flex-col justify-center items-center dark:text-gray-100">
      <header className="w-screen text-center min-h-[236px]">
        <div className="text-5xl font-bold text-mainColor dark:text-neutral-200">
          {APP_NAME}
        </div>
        <div className="mt-4 text-xl text-mainColor dark:text-neutral-300">
          {APP_SUBTITLE}
        </div>
      </header>
      <div className="w-[80%] md:w-[60%] lg:w-[45%] xl:w-[35%]">
        {unauthorized ? (
          <>
            <Alert
              data-testid="device-gate-denied"
              className="mb-4"
              type="warning"
              showIcon
              icon={<SafetyOutlined />}
              message="本机没有已授权的设备钥匙，无法进入登录页。"
              description={
                <span>
                  本服务仅允许绑定钥匙的设备登录。如需授权本机：
                  <br />
                  1. 在下方生成本机钥匙串；
                  <br />
                  2. 从任一<b>已授权设备</b>打开「设置 →
                  设备管理」页，录入该钥匙串；
                  <br />
                  3. 完成后刷新页面。
                </span>
              }
            />
            <KeyGenCard />
          </>
        ) : (
          <Alert
            data-testid="device-gate-denied"
            type="info"
            showIcon
            icon={<Spin size="small" />}
            message={denial.detail || "设备验证暂时无法完成，请稍后刷新重试。"}
          />
        )}
      </div>
    </div>
  );
};

import { FC, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Input,
  List,
  Modal,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import {
  CopyOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import copy from "copy-to-clipboard";
import dayjs from "dayjs";
import { SettingContainerProps } from "@/components/setting-container";
import { useIsMobile } from "@hopgoldy/cube-ui";
import {
  ErrorInvalidDeviceKey,
  generateDeviceKeyPair,
  linkDeviceId,
  listLocalDeviceKeys,
  parseDeviceKey,
  removeLocalDeviceKey,
  suggestDeviceName,
} from "@/lib/device-key";
import {
  useAddDevice,
  useDeviceList,
  useRevokeDevice,
} from "@/services/device";
import { messageError, messageSuccess, messageWarning } from "@/utils/message";

const { Text } = Typography;

/**
 * 设备门状态说明：
 * - 设备数 > 0 → 门已激活，登录走廊需静默过门；
 * - 设备数 = 0 → 纯密码模式（与历史行为一致），此时生成/添加 = 预绑定第一台设备。
 */
const GateStatusAlert: FC<{ gateEnabled: boolean }> = ({ gateEnabled }) => (
  <Alert
    className="mb-4"
    type={gateEnabled ? "success" : "info"}
    showIcon
    message={
      gateEnabled
        ? "设备门已激活：仅绑定钥匙的设备可进入登录页，登录时自动静默过门"
        : "设备门未激活（纯密码模式）：绑定第一台设备后，陌生设备将被挡在登录页之外"
    }
  />
);

/** 钥匙串展示卡片：只读文本框 + 复制按钮（等价 authorized_keys 的一行） */
const GeneratedKeyCard: FC<{
  deviceKey: string;
  onAdd: () => void;
  adding: boolean;
}> = ({ deviceKey, onAdd, adding }) => (
  <Card
    className="my-3"
    size="small"
    type="inner"
    title="本机钥匙串（请从已授权设备录入）"
  >
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
    <div className="mt-3 flex flex-row-reverse">
      <Button type="primary" loading={adding} onClick={onAdd}>
        直接添加到服务端（本机即受信设备）
      </Button>
    </div>
  </Card>
);

export const Content: FC<SettingContainerProps> = (props) => {
  const isMobile = useIsMobile();
  const [inputKey, setInputKey] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  /** 本机 IndexedDB 中已关联服务端 id 的钥匙（用于标记列表中的「本机」设备） */
  const [localDeviceIds, setLocalDeviceIds] = useState<string[]>([]);

  const { data: listResp, isFetching } = useDeviceList();
  const { mutateAsync: addDevice, isPending: isAdding } = useAddDevice();
  const { mutateAsync: revokeDevice, isPending: isRevoking } =
    useRevokeDevice();

  const devices = listResp?.data?.items ?? [];
  const gateEnabled = devices.length > 0;

  const refreshLocalDeviceIds = () => {
    listLocalDeviceKeys()
      .then((keys) =>
        setLocalDeviceIds(
          keys
            .map((key) => key.deviceId)
            .filter((id): id is string => typeof id === "string"),
        ),
      )
      .catch(() => setLocalDeviceIds([]));
  };

  useEffect(() => {
    refreshLocalDeviceIds();
  }, [devices.length]);

  /** 生成本机钥匙：句柄暂存 IndexedDB pending 槽位，钥匙串展示给用户复制/录入 */
  const onGenerate = async () => {
    setIsGenerating(true);
    try {
      const { deviceKey } = await generateDeviceKeyPair(suggestDeviceName());
      setGeneratedKey(deviceKey);
      messageSuccess("本机钥匙已生成");
    } catch (err) {
      messageError(`钥匙生成失败：${(err as Error).message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * 自我授权：本机生成 + 本机添加 = 把本机登记为受信设备。
   * 语义上属于「已授权设备的管理页」操作（当前 session 已过门禁）；
   * 门未激活时即预绑定第一台设备。
   */
  const onAddGeneratedKey = async () => {
    if (!generatedKey) return;
    const resp = await addDevice({ deviceKey: generatedKey });
    if (resp.code !== 200) return;
    await linkLocalKey(resp.data!.id);
    setGeneratedKey(null);
    messageSuccess("已添加为本机受信设备，下次登录将自动静默过门");
  };

  /** 录入成功后把 IndexedDB 中的 pending 句柄迁移到服务端设备 id 下（静默过门按 id 取句柄） */
  const linkLocalKey = async (deviceId: string) => {
    try {
      await linkDeviceId(deviceId);
    } catch {
      // 句柄迁移失败不阻断录入：钥匙串仍在，稍后可重新生成重绑
      messageWarning("钥匙句柄关联失败，本机静默过门可能不可用");
    }
    refreshLocalDeviceIds();
  };

  /** 粘贴录入：本地先做格式校验给友好错误，再交由服务端复检（公钥重复等） */
  const onAddByKeyString = async () => {
    const deviceKey = inputKey.trim();
    if (!deviceKey) {
      messageWarning("请输入设备钥匙串");
      return;
    }
    try {
      parseDeviceKey(deviceKey);
    } catch (err) {
      messageError(
        `钥匙串格式不正确（${(err as ErrorInvalidDeviceKey).message}），请检查是否完整复制`,
      );
      return;
    }
    const resp = await addDevice({ deviceKey });
    if (resp.code !== 200) return;
    setInputKey("");
    messageSuccess("设备已录入");
  };

  const onRevoke = (id: string, name: string) => {
    Modal.confirm({
      title: "确定吊销该设备？",
      content: `吊销后「${name}」将无法再通过门禁，需要重新录入钥匙串才能恢复访问。`,
      okText: "吊销",
      okType: "danger",
      onOk: async () => {
        const resp = await revokeDevice({ id });
        if (resp.code !== 200) return;
        // 若吊销的是本机（本机存有该 id 的句柄），句柄一并清除，避免留下失效钥匙
        if (localDeviceIds.includes(id)) {
          await removeLocalDeviceKey(id).catch(() => undefined);
        }
        refreshLocalDeviceIds();
        messageSuccess(`已吊销设备「${name}」`);
      },
    });
  };

  const renderContent = () => (
    <Spin spinning={isFetching}>
      <GateStatusAlert gateEnabled={gateEnabled} />

      {/* 设备列表：名称 / 绑定时间 / 最近过门时间 / 吊销 */}
      <List
        className="mb-4"
        header={<Text strong>受信设备</Text>}
        locale={{
          emptyText: (
            <div className="mt-4 mb-2">
              暂无受信设备，生成一把钥匙并录入以激活设备门
            </div>
          ),
        }}
        dataSource={devices}
        renderItem={(item) => (
          <List.Item
            actions={[
              <Button
                key="revoke"
                danger
                size="small"
                loading={isRevoking}
                onClick={() => onRevoke(item.id, item.name)}
              >
                吊销
              </Button>,
            ]}
          >
            <List.Item.Meta
              avatar={
                <SafetyCertificateOutlined className="text-2xl text-green-500" />
              }
              title={
                <span>
                  {item.name}{" "}
                  {localDeviceIds.includes(item.id) && (
                    <Tag color="green">本机</Tag>
                  )}
                </span>
              }
              description={`绑定于 ${dayjs(item.createdAt).format("YYYY-MM-DD HH:mm")}，最近使用 ${dayjs(item.lastSeenAt).format("YYYY-MM-DD HH:mm")}`}
            />
          </List.Item>
        )}
      />

      {/* 本机钥匙：生成 → 展示钥匙串 → 复制去其他设备录入 / 门未激活时直接添加 */}
      <Card size="small" type="inner" title="生成本机钥匙" className="mb-4">
        <div className="mb-3 text-slate-500 dark:text-slate-400 cursor-default">
          <ThunderboltOutlined className="mr-1" />
          在本机浏览器内生成非导出私钥（私钥字节永不出浏览器密钥库）。把钥匙串录入到
          任意一台已授权设备即可绑定本机；若服务端还没有任何设备（纯密码模式），可直接添加以绑定第一台设备。
        </div>
        <Button
          type="primary"
          loading={isGenerating}
          onClick={onGenerate}
          disabled={isAdding}
        >
          生成本机钥匙
        </Button>
        {generatedKey && (
          <GeneratedKeyCard
            deviceKey={generatedKey}
            onAdd={onAddGeneratedKey}
            adding={isAdding}
          />
        )}
      </Card>

      {/* 录入其他设备生成的钥匙串（在已授权设备上操作） */}
      <Card size="small" type="inner" title="录入设备钥匙串" className="mb-4">
        <Space.Compact className="w-full">
          <Input
            placeholder="粘贴 cube-device-key:v1:... 钥匙串"
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            onPressEnter={onAddByKeyString}
            allowClear
          />
          <Button type="primary" loading={isAdding} onClick={onAddByKeyString}>
            添加
          </Button>
        </Space.Compact>
      </Card>
    </Spin>
  );

  if (!isMobile) {
    return (
      <>
        {renderContent()}
        <div className="flex flex-row-reverse">
          <Button onClick={props.onClose}>返回</Button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4">{renderContent()}</div>
      <div className="p-3 border-t border-gray-200 flex gap-2 justify-end">
        <Button onClick={props.onClose}>返回</Button>
      </div>
    </>
  );
};

import { FC, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Input,
  List,
  App,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
} from "antd";
import { SafetyCertificateOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { SettingContainerProps } from "@/components/setting-container";
import { useIsMobile } from "@hopgoldy/cube-ui";
import {
  clearLocalDeviceKey,
  ErrorInvalidDeviceKey,
  generateDeviceKeyPair,
  getLocalDeviceKey,
  parseDeviceKey,
  suggestDeviceName,
} from "@/lib/device-key";
import {
  useAddDevice,
  useDeviceList,
  useGateConfig,
  useRevokeDevice,
  useUpdateGateConfig,
} from "@/services/device";
import { messageError, messageSuccess, messageWarning } from "@/utils/message";

const { Text } = Typography;

/**
 * 设备验证状态说明（开关语义见 docs/plans/gate-switch）：
 * - 开关 ON → 门激活，登录走廊仅绑定钥匙的设备可静默过门；
 * - 开关 OFF → 不拦（纯密码模式），受信设备清单原样保留，可预绑定设备。
 */
const GateStatusAlert: FC<{ gateEnabled: boolean }> = ({ gateEnabled }) => (
  <Alert
    className="mb-4"
    type={gateEnabled ? "success" : "info"}
    showIcon
    message={
      gateEnabled
        ? "设备验证已激活：仅绑定钥匙的设备可进入登录页，登录时自动静默过门"
        : "设备验证未开启（纯密码模式）：任何知道地址的设备都可尝试登录"
    }
  />
);

/** 顶部设备验证开关卡片：标题 + 说明 + Switch */
const GateSwitchCard: FC<{
  checked: boolean;
  loading: boolean;
  onChange: (checked: boolean) => void;
}> = ({ checked, loading, onChange }) => (
  <Card size="small" className="mb-4">
    <div className="flex items-center justify-between gap-4">
      <div>
        <Text strong>仅授权设备允许登录</Text>
        <div className="text-slate-500 dark:text-slate-400 text-sm cursor-default">
          开启后，只有绑定钥匙串的受信设备能通过登录页的设备验证
        </div>
      </div>
      <Switch checked={checked} loading={loading} onChange={onChange} />
    </div>
  </Card>
);

export const Content: FC<SettingContainerProps> = (props) => {
  const { modal } = App.useApp();
  const isMobile = useIsMobile();
  const [inputKey, setInputKey] = useState("");
  /** 本机钥匙公钥（用于标记列表中的「本机」设备：公钥即身份） */
  const [localPublicKey, setLocalPublicKey] = useState<string | null>(null);
  /** 首次开启引导态：开关被点开但门尚未启用（设备数为 0，需先绑定设备） */
  const [pendingEnable, setPendingEnable] = useState(false);
  /** 「设为本机受信设备并开启」一键流程进行中 */
  const [isEnabling, setIsEnabling] = useState(false);

  const { data: gateConfigResp, isLoading: isGateConfigLoading } =
    useGateConfig();
  const { data: listResp, isFetching } = useDeviceList();
  const { mutateAsync: addDevice, isPending: isAdding } = useAddDevice();
  const { mutateAsync: revokeDevice, isPending: isRevoking } =
    useRevokeDevice();
  const { mutateAsync: updateGateConfig, isPending: isUpdatingGate } =
    useUpdateGateConfig();

  const devices = listResp?.data?.items ?? [];
  /** 门开关唯一判定 = AppConfig deviceGateEnabled（与设备清单无关） */
  const gateEnabled = gateConfigResp?.data?.enabled ?? false;
  /** 受信设备数量：再启用（confirm 直开）与首次开启（引导绑定）的分流判定 */
  const deviceCount = gateConfigResp?.data?.deviceCount ?? 0;

  /**
   * 开关视觉态：ON = 门已启用；pendingEnable = 首次开启引导中（视觉保持开启待定，
   * 关掉即取消引导，未产生任何服务端变更）
   */
  const switchChecked = gateEnabled || pendingEnable;
  const switchLoading = isUpdatingGate || isEnabling || isGateConfigLoading;

  const refreshLocalPublicKey = () => {
    getLocalDeviceKey()
      .then((key) => setLocalPublicKey(key?.publicKey ?? null))
      .catch(() => setLocalPublicKey(null));
  };

  useEffect(() => {
    refreshLocalPublicKey();
  }, []);

  /**
   * 首次开启引导的「保存并启用」：先 /device/add 绑定设备，再 updateGateConfig(true)
   * （顺序不能反——后端开启守卫依赖设备已入库）。两步各自失败各自报错；
   * add 成功而 update 失败时设备已入库（无害），保留重试入口只补 update。
   */
  /**
   * 一键流程：生成钥匙（固定槽覆盖写）→ 组装钥匙串 → 录入服务端 → 开启验证。
   * 幂等可重试：重复点击重新生成新钥匙覆盖旧槽，重新走完整链路。
   */
  const onEnrollAndEnable = async () => {
    if (isEnabling) return;
    setIsEnabling(true);
    try {
      const { deviceKey } = await generateDeviceKeyPair(suggestDeviceName());
      const addResp = await addDevice({ deviceKey });
      if (addResp.code !== 200) return;
      refreshLocalPublicKey();
      const updateResp = await updateGateConfig({ enabled: true });
      if (updateResp.code !== 200) {
        messageWarning("设备已录入，但开启失败，请重试");
        return;
      }
      setPendingEnable(false);
      messageSuccess("设备验证已开启，本机登录将自动静默过门");
    } catch (err) {
      messageError(`操作失败：${(err as Error).message}`);
    } finally {
      setIsEnabling(false);
    }
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

  /**
   * 开关切换状态机：
   * - 关（已启用）→ confirm → updateGateConfig(false)，设备清单不动，回 OFF 态
   * - 关（引导态）→ 直接取消引导（无服务端变更）
   * - 开（deviceCount > 0）→ confirm「开启后仅授权设备可登录」→ updateGateConfig(true)
   * - 开（deviceCount = 0，首次）→ 不调 update（后端 400 守卫），进引导态绑首台设备
   */
  const onSwitchChange = (checked: boolean) => {
    if (!checked) {
      if (pendingEnable) {
        setPendingEnable(false);
        return;
      }
      modal.confirm({
        title: "确定关闭设备验证？",
        content:
          "关闭后任何知道地址的设备都能尝试登录。受信设备清单将保留，可随时重新开启。",
        okText: "关闭设备验证",
        okType: "danger",
        onOk: async () => {
          const resp = await updateGateConfig({ enabled: false });
          if (resp.code !== 200) return;
          messageSuccess("设备验证已关闭");
        },
      });
      return;
    }
    if (deviceCount > 0) {
      modal.confirm({
        title: "确定开启设备验证？",
        content:
          "开启后仅授权设备可登录：未绑定钥匙串的设备将被挡在登录页之外。",
        okText: "开启",
        onOk: async () => {
          const resp = await updateGateConfig({ enabled: true });
          if (resp.code !== 200) return;
          messageSuccess("设备验证已开启");
        },
      });
      return;
    }
    // 首次开启：进入引导态，由引导卡完成「生成本机钥匙串 → 保存并启用」
    setPendingEnable(true);
  };

  /** ON 态完整管理内容：设备列表 / 生成本机钥匙 / 录入其他设备（现有功能平移） */
  const renderFullManage = () => (
    <>
      <GateStatusAlert gateEnabled={gateEnabled} />

      {/* 设备列表：名称 / 绑定时间 / 最近过门时间 / 吊销 */}
      <List
        className="mb-4"
        header={<Text strong>受信设备</Text>}
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
                  {item.publicKey === localPublicKey && (
                    <Tag color="green">本机</Tag>
                  )}
                </span>
              }
              description={`绑定于 ${dayjs(item.createdAt).format("YYYY-MM-DD HH:mm")}，最近使用 ${dayjs(item.lastSeenAt).format("YYYY-MM-DD HH:mm")}`}
            />
          </List.Item>
        )}
      />

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
    </>
  );

  /** 绑定本机引导卡：一键「将本机设为受信设备」 */
  const renderEnrollGuide = () => (
    <Card size="small" type="inner" title="受信设备" className="mb-4">
      <div className="mb-3 text-slate-500 dark:text-slate-400 text-sm cursor-default">
        当前还没有任何受信设备。将本机设为第一台受信设备后，即可开启「仅授权设备允许登录」。
      </div>
      <Button
        type="primary"
        block
        loading={isEnabling}
        onClick={onEnrollAndEnable}
      >
        将本机设为受信设备
      </Button>
    </Card>
  );

  const onRevoke = (id: string, name: string) => {
    const isLastTrustedDevice = gateEnabled && devices.length <= 1;
    modal.confirm({
      title: "确定吊销该设备？",
      content: `吊销后「${name}」将无法再通过门禁，需要重新录入钥匙串才能恢复访问。${
        isLastTrustedDevice
          ? "这是最后一台受信设备，门开启状态下移除后将无人能通过设备验证（恢复方式：关闭设备验证开关）"
          : ""
      }`,
      okText: "吊销",
      okType: "danger",
      onOk: async () => {
        const resp = await revokeDevice({ id });
        if (resp.code !== 200) return;
        const target = devices.find((d) => d.id === id);
        // 若吊销的是本机（公钥一致），本地钥匙一并清除，避免留下失效钥匙
        if (target && target.publicKey === localPublicKey) {
          await clearLocalDeviceKey().catch(() => undefined);
        }
        refreshLocalPublicKey();
        messageSuccess(`已吊销设备「${name}」`);
      },
    });
  };

  const renderContent = () => (
    <Spin spinning={isFetching}>
      <GateSwitchCard
        checked={switchChecked}
        loading={switchLoading}
        onChange={onSwitchChange}
      />
      {/* OFF 态：开关下方无任何内容；清单为空时主动展示绑定引导（含吊销光设备后的重新绑定） */}
      {switchChecked &&
        (pendingEnable || devices.length === 0
          ? renderEnrollGuide()
          : renderFullManage())}
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

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
  buildDeviceKey,
  ErrorInvalidDeviceKey,
  generateDeviceKeyPair,
  getPendingDeviceKey,
  linkDeviceId,
  listLocalDeviceKeys,
  parseDeviceKey,
  removeLocalDeviceKey,
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

/** 钥匙串展示卡片：只读文本框 + 复制按钮（等价 authorized_keys 的一行） */
const GeneratedKeyCard: FC<{
  deviceKey: string;
  title?: string;
  onAdd?: () => void;
  adding?: boolean;
}> = ({ deviceKey, title, onAdd, adding }) => (
  <Card
    className="my-3"
    size="small"
    type="inner"
    title={title ?? "本机钥匙串（请从已授权设备录入）"}
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
    {onAdd && (
      <div className="mt-3 flex flex-row-reverse">
        <Button type="primary" loading={adding} onClick={onAdd}>
          直接添加到服务端（本机即受信设备）
        </Button>
      </div>
    )}
  </Card>
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
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  /** 本机 IndexedDB 中已关联服务端 id 的钥匙（用于标记列表中的「本机」设备） */
  const [localDeviceIds, setLocalDeviceIds] = useState<string[]>([]);
  /** 首次开启引导态：开关被点开但门尚未启用（设备数为 0，需先绑定设备） */
  const [pendingEnable, setPendingEnable] = useState(false);
  /** 引导流程中设备已录入但门尚未启用（update 失败后的重试态） */
  const [addedDeviceId, setAddedDeviceId] = useState<string | null>(null);
  /** 「保存并启用」两步调用进行中 */
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
   * 门未激活时即预绑定设备。
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

  /**
   * 首次开启引导的「保存并启用」：先 /device/add 绑定设备，再 updateGateConfig(true)
   * （顺序不能反——后端开启守卫依赖设备已入库）。两步各自失败各自报错；
   * add 成功而 update 失败时设备已入库（无害），保留重试入口只补 update。
   */
  const onSaveAndEnable = async () => {
    if (isEnabling) return;
    if (!generatedKey && !addedDeviceId) return;
    setIsEnabling(true);
    try {
      let deviceId = addedDeviceId;
      if (!deviceId) {
        // 以 IndexedDB pending 槽为唯一事实来源重建钥匙串，不信任组件 state——
        // 重复点「生成」等场景下 state 与存储可能短暂不一致（state 旧/存储新），
        // 提交旧公钥会让服务端登记与本地句柄错位，静默过门必然失败
        const pending = await getPendingDeviceKey();
        if (!pending) {
          messageWarning("本机钥匙不存在，请先生成本机钥匙串");
          return;
        }
        const deviceKey = buildDeviceKey({
          name: pending.name,
          publicKey: pending.publicKey,
        });
        const addResp = await addDevice({ deviceKey });
        // 录入失败：错误提示已由拦截器展示，留在引导态可重试
        if (addResp.code !== 200) return;
        deviceId = addResp.data!.id;
        setAddedDeviceId(deviceId);
        // 钥匙串已入库，不再展示原始串；此后重试只补 update，不会重复录入
        setGeneratedKey(null);
        await linkLocalKey(deviceId);
      }
      const updateResp = await updateGateConfig({ enabled: true });
      if (updateResp.code !== 200) {
        messageWarning("设备已录入，但门开启失败，请重试「保存并启用」");
        return;
      }
      setAddedDeviceId(null);
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
        setGeneratedKey(null);
        setAddedDeviceId(null);
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
        locale={{
          emptyText: (
            <div className="mt-4 mb-2">
              暂无受信设备，可生成钥匙串或录入其他设备的钥匙串
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

      {/* 本机钥匙：生成 → 展示钥匙串 → 复制去其他设备录入 / 直接添加。
          本机已是受信设备时隐藏（生成用于绑定新设备，由对方设备操作） */}
      {localDeviceIds.length === 0 && (
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
      )}

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

  /** 首次开启引导卡：① 生成本机钥匙串 ② 保存并启用（两步调用，add 在前） */
  const renderFirstEnableGuide = () => (
    <Card size="small" type="inner" title="开启设备验证" className="mb-4">
      <Alert
        className="mb-4"
        type="warning"
        showIcon
        message="当前还没有任何受信设备。请先生成本机钥匙串并绑定本机，再开启设备验证。"
      />
      <div className="mb-2">
        <Text strong>1. 生成本机钥匙串</Text>
      </div>
      <div className="mb-3 text-slate-500 dark:text-slate-400 text-sm cursor-default">
        在本机浏览器内生成非导出私钥（私钥字节永不出浏览器密钥库）。
      </div>
      <Button type="primary" loading={isGenerating} onClick={onGenerate}>
        生成本机钥匙串
      </Button>
      {generatedKey && (
        <GeneratedKeyCard
          deviceKey={generatedKey}
          title="本机钥匙串（保存并启用后本机即受信设备）"
        />
      )}
      <div className="mt-4 mb-2">
        <Text strong>2. 保存并启用</Text>
      </div>
      <div className="mb-3 text-slate-500 dark:text-slate-400 text-sm cursor-default">
        将本机登记为受信设备并开启设备验证，完成后本机登录可自动静默过门。
      </div>
      <Button
        type="primary"
        loading={isEnabling}
        disabled={!generatedKey && !addedDeviceId}
        onClick={onSaveAndEnable}
      >
        {addedDeviceId ? "重试启用" : "保存并启用"}
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
      <GateSwitchCard
        checked={switchChecked}
        loading={switchLoading}
        onChange={onSwitchChange}
      />
      {/* OFF 态：开关下方无任何内容 */}
      {switchChecked &&
        (pendingEnable ? renderFirstEnableGuide() : renderFullManage())}
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

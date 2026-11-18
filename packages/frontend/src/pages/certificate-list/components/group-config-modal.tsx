import { FC, useEffect, useState } from "react";
import {
  Form,
  Row,
  Col,
  Input,
  Modal,
  Segmented,
  Button,
  Space,
  Tooltip,
} from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import {
  DEFAULT_KDF_PARAMS,
  deriveMasterKey,
  randomBytes,
  SALT_LENGTH,
} from "@/lib/e2ee";
import { bytesToHex } from "@/lib/e2ee/format";
import { messageSuccess } from "@/utils/message";
import { useSetDefaultGroup, useUpdateGroupConfig } from "@/services/group";
import type { SchemaGroupItemType } from "@shared-types/group";
import { stateUnlockedGroupIds, stateUser } from "@/store/user";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { GroupDeleteConfirm } from "./group-delete-confirm";

const useLockTypeOptions = () => {
  const [userInfo] = useAtom(stateUser);
  const options = [
    { label: "不加密", value: "None" },
    { label: "独立密码", value: "Password" },
  ];
  if (userInfo?.withTotp) {
    options.push({ label: "TOTP 加密", value: "Totp" });
  }
  return options;
};

interface GroupConfigModalProps {
  open: boolean;
  group: SchemaGroupItemType;
  /** 是否为最后一个分组（至少保留一个，禁止删除） */
  isLastGroup?: boolean;
  onClose: () => void;
}

export const GroupConfigModal: FC<GroupConfigModalProps> = ({
  open,
  group,
  isLastGroup = false,
  onClose,
}) => {
  const [form] = Form.useForm();
  const [userInfo, setUserInfo] = useAtom(stateUser);
  const unlockedGroupIds = useAtomValue(stateUnlockedGroupIds);
  const setUnlockedGroupIds = useSetAtom(stateUnlockedGroupIds);
  const { mutateAsync: runSetDefault, isPending: settingDefault } =
    useSetDefaultGroup();
  const { mutateAsync: runUpdateConfig, isPending: updatingConfig } =
    useUpdateGroupConfig();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const lockType = Form.useWatch("lockType", form);
  const [prevLockType, setPrevLockType] = useState<string>();
  const isDefaultGroup = userInfo?.defaultGroupId === group.id;
  const lockTypeOptions = useLockTypeOptions();

  useEffect(() => {
    if (!open) return;
    setPrevLockType(group.lockType);
    form.setFieldsValue({ lockType: group.lockType });
  }, [open, group]);

  const onCancelModal = () => {
    onClose();
    form.resetFields();
  };

  const onSetDefaultGroup = async () => {
    const resp = await runSetDefault({ id: group.id });
    if (resp.code !== 200) return;
    messageSuccess("默认分组设置成功");
    setUserInfo((prev) =>
      prev ? { ...prev, defaultGroupId: group.id } : prev,
    );
  };

  const onSaveConfig = async () => {
    const values = await form.validateFields();

    let passwordHash: string | undefined;
    let passwordSalt: string | undefined;
    let kdfParams: string | undefined;
    if (values.password) {
      // v2：argon2id(password, salt, kdfParams) → 64B，前 32B KEK（分组场景丢弃）
      // + 后 32B V；存 passwordHash = hex(V)，与主密码同构
      const salt = randomBytes(SALT_LENGTH);
      const { verifier } = await deriveMasterKey(
        values.password,
        salt,
        DEFAULT_KDF_PARAMS,
      );
      passwordHash = bytesToHex(verifier);
      passwordSalt = bytesToHex(salt);
      kdfParams = JSON.stringify(DEFAULT_KDF_PARAMS);
    }

    // 给组上锁时先把该组移出解锁集再请求：useUpdateGroupConfig 成功后立刻失效
    // 证书列表缓存，若此刻页面观察者仍 enabled，会对刚上锁的分组发起
    // certificate/list（服务端 403），被全局拦截器重定向到 403 页。
    // 请求失败则回滚本地解锁态。
    const willLock = values.lockType !== "None";
    const wasUnlocked = unlockedGroupIds.has(group.id);
    if (willLock) {
      setUnlockedGroupIds((prev: Set<number>) => {
        const next = new Set(prev);
        next.delete(group.id);
        return next;
      });
    }

    const resp = await runUpdateConfig({
      id: group.id,
      lockType: values.lockType,
      passwordHash,
      passwordSalt,
      kdfParams,
    });
    if (resp.code !== 200) {
      if (willLock && wasUnlocked) {
        setUnlockedGroupIds((prev: Set<number>) => new Set(prev).add(group.id));
      }
      return;
    }

    messageSuccess("保存成功");
    onCancelModal();

    // 列表（含 lockType/salt/kdfParams）由 useUpdateGroupConfig 的 invalidate 自动刷新。
    // 解锁态双向同步：lockType 变为 "None" 时按派生条件自动解锁；
    // 上锁则已在请求前移出解锁集，本 session 须重新输入密码解锁。
  };

  return (
    <>
      <Modal
        title="分组配置"
        open={open}
        onCancel={onCancelModal}
        footer={
          <Space>
            <Tooltip title={isLastGroup ? "至少保留一个分组" : undefined}>
              <span>
                <Button
                  icon={<DeleteOutlined />}
                  danger
                  disabled={isLastGroup}
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  删除
                </Button>
              </span>
            </Tooltip>
            <Button
              disabled={isDefaultGroup}
              onClick={onSetDefaultGroup}
              loading={settingDefault}
            >
              {isDefaultGroup ? "默认分组" : "设为默认分组"}
            </Button>
            <Button
              onClick={onSaveConfig}
              type="primary"
              loading={updatingConfig}
            >
              保存
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          labelCol={{ span: 6 }}
          labelAlign="right"
          initialValues={{ lockType: "None" }}
        >
          <Row className="md:mt-6">
            <Col span={24}>
              <Form.Item label="加密方式" name="lockType">
                <Segmented block options={lockTypeOptions} />
              </Form.Item>
            </Col>
            {lockType === "Password" && (
              <>
                <Col span={24}>
                  <Form.Item
                    label="分组密码"
                    name="password"
                    hasFeedback
                    rules={[
                      {
                        required: prevLockType !== "Password",
                        message: "请填写分组密码",
                      },
                    ]}
                  >
                    <Input.Password placeholder="请输入" />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item
                    label="重复密码"
                    name="passwordConfirm"
                    rules={[
                      {
                        required: prevLockType !== "Password",
                        message: "请重复分组密码",
                      },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue("password") === value) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error("与分组密码不一致"));
                        },
                      }),
                    ]}
                  >
                    <Input.Password placeholder="请输入" />
                  </Form.Item>
                </Col>
              </>
            )}
          </Row>
        </Form>
      </Modal>
      <GroupDeleteConfirm
        open={showDeleteConfirm}
        group={group}
        onClose={() => setShowDeleteConfirm(false)}
        onDeleted={onCancelModal}
      />
    </>
  );
};

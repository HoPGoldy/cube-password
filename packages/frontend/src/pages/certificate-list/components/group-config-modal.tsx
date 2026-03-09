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
  Result,
} from "antd";
import { DeleteOutlined, WarningOutlined } from "@ant-design/icons";
import { nanoid } from "nanoid";
import { sha512 } from "@/utils/crypto";
import { messageSuccess, messageWarning } from "@/utils/message";
import {
  useDeleteGroup,
  useSetDefaultGroup,
  useUpdateGroupConfig,
} from "@/services/group";
import { GroupInfo, stateGroupList, stateUser } from "@/store/user";
import { useAtom, useSetAtom } from "jotai";
import { useNavigate } from "react-router-dom";

const LOCK_TYPE_OPTIONS = [
  { label: "不加密", value: "None" },
  { label: "独立密码", value: "Password" },
];

interface GroupConfigModalProps {
  open: boolean;
  group: GroupInfo;
  onClose: () => void;
}

export const GroupConfigModal: FC<GroupConfigModalProps> = ({
  open,
  group,
  onClose,
}) => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useAtom(stateUser);
  const setGroupList = useSetAtom(stateGroupList);
  const { mutateAsync: runDeleteGroup, isPending: deleting } = useDeleteGroup();
  const { mutateAsync: runSetDefault, isPending: settingDefault } =
    useSetDefaultGroup();
  const { mutateAsync: runUpdateConfig, isPending: updatingConfig } =
    useUpdateGroupConfig();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const lockType = Form.useWatch("lockType", form);
  const [prevLockType, setPrevLockType] = useState<string>();
  const isDefaultGroup = userInfo?.defaultGroupId === group.id;

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

  const onCancelDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    setDeleteConfirmInput("");
  };

  const onDeleteGroup = async () => {
    if (deleteConfirmInput !== group.name) {
      messageWarning("分组名称不正确");
      onCancelDeleteConfirm();
      return;
    }

    const resp = await runDeleteGroup({ id: group.id });
    if (resp.code !== 200) {
      onCancelDeleteConfirm();
      return;
    }

    onCancelDeleteConfirm();
    onCancelModal();
    messageSuccess("分组删除成功");

    // Remove group from list and navigate to default
    setGroupList((prev) => prev.filter((g) => g.id !== group.id));
    const newDefault = userInfo?.defaultGroupId;
    if (newDefault && newDefault !== group.id) {
      navigate(`/group/${newDefault}`);
    } else {
      navigate("/");
    }
  };

  const onSaveConfig = async () => {
    const values = await form.validateFields();

    let passwordHash: string | undefined;
    if (values.password) {
      const salt = nanoid(128);
      passwordHash = sha512(salt + values.password);
    }

    const resp = await runUpdateConfig({
      id: group.id,
      lockType: values.lockType,
      passwordHash,
    });
    if (resp.code !== 200) return;

    messageSuccess("保存成功");
    onCancelModal();

    // Update group lockType in store
    setGroupList((prev) =>
      prev.map((g) =>
        g.id === group.id
          ? {
              ...g,
              lockType: values.lockType,
              unlocked: values.lockType === "None",
            }
          : g,
      ),
    );
  };

  return (
    <>
      <Modal
        title="分组配置"
        open={open}
        onCancel={onCancelModal}
        footer={
          <Space>
            <Button
              icon={<DeleteOutlined />}
              danger
              onClick={() => setShowDeleteConfirm(true)}
            >
              删除
            </Button>
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
                <Segmented block options={LOCK_TYPE_OPTIONS} />
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
      <Modal
        open={showDeleteConfirm}
        closable={false}
        width={400}
        onCancel={onCancelDeleteConfirm}
        footer={false}
      >
        <Result
          className="p-0"
          icon={<WarningOutlined className="!text-yellow-400" />}
          title="分组删除确认"
          subTitle={
            <div className="text-black">
              分组删除后，其中的凭证将被 <b>一并删除</b>{" "}
              且无法恢复，如果确定要删除，请在下方输入"{group.name}"
            </div>
          }
          extra={
            <Row gutter={[8, 8]}>
              <Col span={24}>
                <Input
                  placeholder="请输入分组名称"
                  value={deleteConfirmInput}
                  onChange={(e) => setDeleteConfirmInput(e.target.value)}
                  onKeyUp={(e) => {
                    if (e.key === "Enter") onDeleteGroup();
                  }}
                />
              </Col>
              <Col span={12}>
                <Button block onClick={onCancelDeleteConfirm}>
                  返回
                </Button>
              </Col>
              <Col span={12}>
                <Button
                  type="primary"
                  danger
                  block
                  onClick={onDeleteGroup}
                  loading={deleting}
                >
                  删除
                </Button>
              </Col>
            </Row>
          }
        />
      </Modal>
    </>
  );
};

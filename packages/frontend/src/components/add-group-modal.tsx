import { FC, useEffect } from "react";
import { Form, Row, Col, Input, Modal, Segmented } from "antd";
import { useAtomValue } from "jotai";
import {
  DEFAULT_KDF_PARAMS,
  deriveMasterKey,
  randomBytes,
  SALT_LENGTH,
} from "@/lib/e2ee";
import { bytesToHex } from "@/lib/e2ee/format";
import { stateUser } from "@/store/user";
import type { SchemaGroupAddBodyType } from "@shared-types/group";

const useLockTypeOptions = () => {
  const userInfo = useAtomValue(stateUser);
  const options = [
    { label: "不加密", value: "None" },
    { label: "密码加密", value: "Password" },
  ];
  if (userInfo?.withTotp) {
    options.push({ label: "TOTP 加密", value: "Totp" });
  }
  return options;
};

interface AddGroupModalProps {
  open: boolean;
  loading?: boolean;
  onOk: (data: SchemaGroupAddBodyType) => void;
  onCancel: () => void;
}

export const AddGroupModal: FC<AddGroupModalProps> = ({
  open,
  loading,
  onOk,
  onCancel,
}) => {
  const [form] = Form.useForm();
  const lockType = Form.useWatch("lockType", form);
  const lockTypeOptions = useLockTypeOptions();

  useEffect(() => {
    if (!open) {
      form.resetFields();
    }
  }, [open, form]);

  const onClickOk = async () => {
    const values = await form.validateFields();

    let passwordHash: string | undefined;
    let passwordSalt: string | undefined;
    let kdfParams: string | undefined;
    if (values.lockType === "Password" && values.password) {
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

    onOk({
      name: values.name,
      lockType: values.lockType,
      passwordHash,
      passwordSalt,
      kdfParams,
    });
  };

  return (
    <Modal
      title="新建分组"
      open={open}
      okText="创建"
      cancelText="取消"
      okButtonProps={{ loading }}
      onOk={onClickOk}
      onCancel={onCancel}
    >
      <Form
        form={form}
        labelCol={{ span: 6 }}
        labelAlign="right"
        initialValues={{ lockType: "None" }}
      >
        <Row className="md:mt-6">
          <Col span={24}>
            <Form.Item
              label="分组名称"
              name="name"
              rules={[{ required: true, message: "分组名称不得为空" }]}
            >
              <Input
                placeholder="请输入分组名"
                data-testid="add-group-name-input"
              />
            </Form.Item>
          </Col>
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
                  rules={[{ required: true, message: "请输入密码" }]}
                >
                  <Input.Password placeholder="请输入" />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item
                  label="重复密码"
                  name="passwordConfirm"
                  rules={[
                    { required: true, message: "请重复分组密码" },
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
  );
};

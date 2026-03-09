import { FC } from "react";
import { Button, Col, Form, Input, Modal, Row, Space } from "antd";
import { useAtomValue } from "jotai";
import { stateMainPwd, stateUser } from "@/store/user";
import { sha512, validateAesMeta } from "@/utils/crypto";
import { queryChallenge, useChangePassword } from "@/services/auth";
import { messageError, messageWarning } from "@/utils/message";
import { useIsMobile } from "@/layouts/responsive";
import { SettingContainerProps } from "@/components/setting-container";

export const Content: FC<SettingContainerProps> = (props) => {
  const [form] = Form.useForm();
  const userInfo = useAtomValue(stateUser);
  const mainPwdInfo = useAtomValue(stateMainPwd);
  const isMobile = useIsMobile();
  const { mutateAsync: postChangePassword, isPending: isChangingPassword } =
    useChangePassword();

  const onSavePassword = async () => {
    const { oldPassword, newPassword } = await form.validateFields();

    if (!mainPwdInfo?.pwdKey || !mainPwdInfo?.pwdIv) {
      messageError("用户信息解析错误，请重新登录");
      return;
    }

    if (!validateAesMeta(oldPassword, mainPwdInfo.pwdKey, mainPwdInfo.pwdIv)) {
      messageWarning("旧密码不正确");
      return;
    }

    const challengeResp = await queryChallenge();
    if (!challengeResp.success) return;

    const challengeCode = challengeResp.data!.code;
    const oldHash = sha512(oldPassword + challengeCode);

    const resp = await postChangePassword({
      oldHash,
      challengeCode,
      newPassword,
    });
    if (resp.code !== 200) return;

    props.onClose();
    Modal.success({
      content: "密码修改成功，请重新登录",
      okText: "重新登录",
      onOk: () => {
        window.location.reload();
      },
    });
  };

  const renderContent = () => {
    return (
      <Form
        form={form}
        labelCol={{ span: 6 }}
        labelAlign="right"
        size={isMobile ? "large" : "middle"}
      >
        <Row className="md:mt-6">
          <Col span={24}>
            <Form.Item
              label="旧密码"
              name="oldPassword"
              rules={[{ required: true, message: "请填写旧密码" }]}
            >
              <Input.Password placeholder="请输入" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="新密码"
              name="newPassword"
              hasFeedback
              rules={[
                { required: true, message: "请填写新密码" },
                { min: 6, message: "密码长度至少6位" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("oldPassword") !== value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error("新旧密码不能相同"));
                  },
                }),
              ]}
            >
              <Input.Password placeholder="请输入" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              label="重复新密码"
              name="confirmPassword"
              rules={[
                { required: true, message: "请重复新密码" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("newPassword") === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error("与新密码不一致"));
                  },
                }),
              ]}
            >
              <Input.Password placeholder="请输入" />
            </Form.Item>
          </Col>
          {userInfo?.withTotp && (
            <Col span={24}>
              <Form.Item
                label="动态验证码"
                name="totp"
                rules={[{ required: true, message: "请输入动态验证码" }]}
              >
                <Input maxLength={6} placeholder="请输入" />
              </Form.Item>
            </Col>
          )}
        </Row>
      </Form>
    );
  };

  if (!isMobile) {
    return (
      <>
        {renderContent()}
        <div className="flex flex-row-reverse">
          <Space>
            <Button onClick={props.onClose}>返回</Button>
            <Button
              type="primary"
              onClick={onSavePassword}
              loading={isChangingPassword}
            >
              保存
            </Button>
          </Space>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4">{renderContent()}</div>
      <div className="p-3 border-t border-gray-200 flex gap-2 justify-end">
        <Button onClick={props.onClose}>返回</Button>
        <Button
          type="primary"
          onClick={onSavePassword}
          loading={isChangingPassword}
        >
          保存
        </Button>
      </div>
    </>
  );
};

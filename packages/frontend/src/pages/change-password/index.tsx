import { FC, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Col, Form, Input, Modal, Row } from "antd";
import { LeftOutlined } from "@ant-design/icons";
import { useAtomValue } from "jotai";
import bcrypt from "bcryptjs";
import { stateMainPwd } from "@/store/user";
import { sha512, validateAesMeta } from "@/utils/crypto";
import { queryChallenge, useChangePassword } from "@/services/auth";
import { usePageTitle } from "@/store/global";
import { messageError, messageWarning } from "@/utils/message";

const ChangePasswordPage: FC = () => {
  usePageTitle("修改密码");
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const mainPwdInfo = useAtomValue(stateMainPwd);
  const { mutateAsync: postChangePassword, isPending } = useChangePassword();

  const onSubmit = async () => {
    const { oldPassword, newPassword } = await form.validateFields();

    if (!mainPwdInfo?.pwdKey || !mainPwdInfo?.pwdIv) {
      messageError("用户信息解析错误，请重新登录");
      return;
    }

    // Validate old password against local AES meta
    if (!validateAesMeta(oldPassword, mainPwdInfo.pwdKey, mainPwdInfo.pwdIv)) {
      messageWarning("旧密码不正确");
      return;
    }

    // Get challenge code
    const challengeResp = await queryChallenge();
    if (!challengeResp.success) return;

    const challengeCode = challengeResp.data!.code;
    const oldHash = sha512(oldPassword + challengeCode);
    const newPasswordHash = bcrypt.hashSync(newPassword, 10);

    const resp = await postChangePassword({
      oldHash,
      challengeCode,
      newPasswordHash,
    });
    if (resp.code !== 200) return;

    Modal.success({
      content: "密码修改成功，请重新登录",
      okText: "重新登录",
      onOk: () => {
        window.location.reload();
      },
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center p-3 border-b border-gray-200">
        <Button
          icon={<LeftOutlined />}
          type="text"
          onClick={() => navigate("/settings")}
        />
        <span className="ml-2 text-lg font-medium">修改密码</span>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <Form form={form} layout="vertical" className="max-w-md mx-auto">
          <Form.Item
            label="旧密码"
            name="oldPassword"
            rules={[{ required: true, message: "请填写旧密码" }]}
          >
            <Input.Password placeholder="请输入旧密码" size="large" />
          </Form.Item>

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
            <Input.Password placeholder="请输入新密码" size="large" />
          </Form.Item>

          <Form.Item
            label="确认新密码"
            name="confirmPassword"
            dependencies={["newPassword"]}
            hasFeedback
            rules={[
              { required: true, message: "请确认新密码" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("两次输入的密码不一致"));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" size="large" />
          </Form.Item>

          <Form.Item className="mt-8">
            <Button
              type="primary"
              size="large"
              block
              loading={isPending}
              onClick={onSubmit}
            >
              确认修改
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
};

export default ChangePasswordPage;

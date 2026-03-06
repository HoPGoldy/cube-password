import { FC, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Form, Input, Modal, QRCode, Spin, message } from "antd";
import { LeftOutlined } from "@ant-design/icons";
import { useSetAtom } from "jotai";
import { stateUser } from "@/store/user";
import { sha512 } from "@/utils/crypto";
import { queryChallenge } from "@/services/auth";
import { useOtpQrcode, useBindOtp, useUnbindOtp } from "@/services/otp";
import { usePageTitle } from "@/store/global";
import { messageWarning } from "@/utils/message";

const OtpConfigPage: FC = () => {
  usePageTitle("动态验证码");
  const navigate = useNavigate();
  const setUserInfo = useSetAtom(stateUser);

  const { data: otpInfo, isLoading, refetch } = useOtpQrcode();
  const { mutateAsync: bindOtp, isPending: isBinding } = useBindOtp();
  const { mutateAsync: removeOtp, isPending: isRemoving } = useUnbindOtp();

  const [initCode, setInitCode] = useState("");
  const [removeVisible, setRemoveVisible] = useState(false);
  const [removeForm] = Form.useForm();
  const [isExpired, setIsExpired] = useState(false);

  const { registered, qrCode } = otpInfo?.data || {};

  // QR code expires after 5 minutes
  useEffect(() => {
    setIsExpired(false);
    if (!otpInfo || registered) return;
    const timer = setTimeout(() => setIsExpired(true), 5 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [otpInfo, registered]);

  const onBind = async () => {
    if (!initCode || initCode.length !== 6) {
      messageWarning("请输入正确的 6 位验证码");
      return;
    }
    const resp = await bindOtp(initCode);
    if (resp.code !== 200) return;

    setInitCode("");
    refetch();
    setUserInfo((prev) => (prev ? { ...prev, withTotp: true } : prev));
    message.success("绑定成功");
  };

  const onRemove = async () => {
    const values = await removeForm.validateFields();

    const challengeResp = await queryChallenge();
    if (!challengeResp.success) return;

    const challengeCode = challengeResp.data!.code;
    const hash = sha512(values.password + challengeCode);

    const resp = await removeOtp({
      hash,
      challengeCode,
      code: values.removeCode,
    });
    if (resp.code !== 200) return;

    setRemoveVisible(false);
    removeForm.resetFields();
    refetch();
    setUserInfo((prev) => (prev ? { ...prev, withTotp: false } : prev));
    message.success("解除绑定成功");
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center p-3 border-b border-gray-200">
        <Button
          icon={<LeftOutlined />}
          type="text"
          onClick={() => navigate("/settings")}
        />
        <span className="ml-2 text-lg font-medium">动态验证码</span>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading && (
          <div className="flex justify-center mt-[20vh]">
            <Spin />
          </div>
        )}

        {!isLoading && !registered && (
          <div className="max-w-lg mx-auto">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <QRCode
                value={qrCode || "-"}
                status={isExpired ? "expired" : "active"}
                onRefresh={() => refetch()}
              />
              <div className="flex-1">
                <p className="leading-7 mb-2">
                  请使用谷歌身份验证器扫描二维码，扫描完成后将会以
                  <code className="bg-slate-200 dark:bg-slate-600 rounded px-1 mx-1">
                    cube-password
                  </code>
                  显示。
                </p>
                <p className="text-sm text-gray-500 mb-3">
                  没有身份验证器？
                  <a
                    className="text-sky-500"
                    href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2"
                    target="_blank"
                    rel="noreferrer"
                  >
                    点此安装
                  </a>
                </p>
                <Input
                  placeholder="请输入 6 位验证码"
                  value={initCode}
                  onChange={(e) => setInitCode(e.target.value)}
                  onKeyUp={(e) => e.key === "Enter" && onBind()}
                  maxLength={6}
                  size="large"
                />
                <Button
                  type="primary"
                  block
                  className="mt-3"
                  loading={isBinding}
                  onClick={onBind}
                >
                  绑定
                </Button>
              </div>
            </div>
            <p className="text-center text-gray-500 text-sm mt-6">
              绑定后将会在重要操作时要求提供验证码，以保证您的账户安全。
            </p>
          </div>
        )}

        {!isLoading && registered && (
          <div className="max-w-md mx-auto text-center">
            <div className="text-7xl my-6">🎉</div>
            <p className="text-lg mb-6">动态验证码已绑定</p>
            <Button danger size="large" onClick={() => setRemoveVisible(true)}>
              解除绑定
            </Button>
          </div>
        )}
      </div>

      {/* Remove OTP modal */}
      <Modal
        open={removeVisible}
        onCancel={() => {
          setRemoveVisible(false);
          removeForm.resetFields();
        }}
        title="解除绑定"
        footer={null}
        destroyOnClose
      >
        <Form form={removeForm} layout="vertical" className="mt-4">
          <Form.Item
            label="登录密码"
            name="password"
            rules={[{ required: true, message: "请输入登录密码" }]}
          >
            <Input.Password placeholder="请输入登录密码" />
          </Form.Item>
          <Form.Item
            label="动态验证码"
            name="removeCode"
            rules={[{ required: true, message: "请输入验证码" }]}
          >
            <Input placeholder="请输入 6 位验证码" maxLength={6} />
          </Form.Item>
          <Button
            type="primary"
            danger
            block
            loading={isRemoving}
            onClick={onRemove}
          >
            确认解除绑定
          </Button>
        </Form>
      </Modal>
    </div>
  );
};

export default OtpConfigPage;

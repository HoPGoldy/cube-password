import { FC, useMemo } from "react";
import { Input, Button, Row, Col, message } from "antd";
import type { InputProps } from "antd";
import type { TextAreaProps } from "antd/es/input";
import { CloseOutlined, GiftOutlined } from "@ant-design/icons";
import { openNewTab } from "@/utils/common";
import { useAtomValue } from "jotai";
import { stateUser } from "@/store/user";
import { customAlphabet } from "nanoid";
import copy from "copy-to-clipboard";

const DEFAULT_PASSWORD_ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
const DEFAULT_PASSWORD_LENGTH = 16;

export interface CertificateField {
  label: string;
  value: string;
}

interface CertificateFieldItemProps {
  showDelete?: boolean;
  value?: CertificateField;
  disabled?: boolean;
  onChange?: (value: CertificateField) => void;
  onDelete: () => void;
}

const COPY_MESSAGE_KEY = "copy";

export const CertificateFieldItem: FC<CertificateFieldItemProps> = (props) => {
  const { value, onChange, onDelete, showDelete, disabled } = props;
  const userInfo = useAtomValue(stateUser);
  const [messageApi, contextHolder] = message.useMessage();

  const [isPassword, isLink] = useMemo(() => {
    return [
      !!["密码", "password", "pwd"].find((text) =>
        value?.label?.toLowerCase().includes(text),
      ),
      !!["http://", "https://"].find((text) => value?.value?.includes(text)),
    ];
  }, [value?.label, value?.value]);

  const onLabelChange = (val: string) => {
    onChange?.({ ...value, label: val } as CertificateField);
  };

  const onValueChange = (val: string) => {
    onChange?.({ ...value, value: val } as CertificateField);
  };

  const onCreatePassword = () => {
    const alphabet = userInfo?.createPwdAlphabet ?? DEFAULT_PASSWORD_ALPHABET;
    const length = userInfo?.createPwdLength ?? DEFAULT_PASSWORD_LENGTH;
    const generate = customAlphabet(alphabet, +length);
    const newPassword = generate();

    onValueChange(newPassword);
    copy(newPassword);
    messageApi.success({ key: COPY_MESSAGE_KEY, content: "新密码已复制" });
  };

  const onFieldClick = () => {
    if (!disabled) return;
    if (!value || !value.value) return;

    if (isLink) {
      openNewTab(value.value);
      return;
    }
    copy(value.value);
    messageApi.success({
      key: COPY_MESSAGE_KEY,
      content: "已复制" + value.label,
    });
  };

  const renderMainInput = () => {
    const commonProps: InputProps = {
      value: value?.value,
      onChange: undefined,
      autoComplete: "new-password",
      "aria-autocomplete": "none",
      readOnly: disabled,
    };

    if (!disabled) {
      commonProps.onChange = (e) => onValueChange(e.target.value);
    } else {
      commonProps.onClick = onFieldClick;
      commonProps.className = "!cursor-pointer caret-transparent";
    }

    if (isPassword) {
      return <Input.Password {...commonProps} />;
    }
    return (
      <Input.TextArea
        {...(commonProps as unknown as TextAreaProps)}
        autoSize={{ minRows: 1, maxRows: 6 }}
      />
    );
  };

  return (
    <div className="relative w-full">
      {contextHolder}
      <Row>
        <Col span={20}>
          <Input
            variant="borderless"
            className="block py-2 pl-0 w-full transition disabled:cursor-default disabled:text-inherit"
            size="small"
            value={value?.label}
            disabled={disabled}
            onChange={(e) => onLabelChange(e.target.value)}
          />
        </Col>
        <Col span={4}>
          <div
            className={`w-full h-9 move-handle ${disabled ? "" : "cursor-move"}`}
          />
        </Col>
      </Row>
      <div className="flex">
        {renderMainInput()}

        {/* 密码生成 */}
        {!disabled && isPassword && (
          <Button
            className="ml-2 w-8 shrink-0 !bg-sky-400"
            type="primary"
            icon={<GiftOutlined />}
            onClick={onCreatePassword}
          />
        )}

        {/* 删除按钮 */}
        {!disabled && showDelete && (
          <Button
            className="ml-2 w-8 shrink-0 !bg-red-400"
            icon={<CloseOutlined />}
            type="primary"
            onClick={onDelete}
          />
        )}
      </div>
    </div>
  );
};

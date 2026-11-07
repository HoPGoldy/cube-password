import { FC, useMemo } from "react";
import { Input, Button, Row, Col, message } from "antd";
import type { InputProps } from "antd";
import type { TextAreaProps } from "antd/es/input";
import { CloseOutlined, ExportOutlined, GiftOutlined } from "@ant-design/icons";
import { openNewTab } from "@/utils/common";
import { useAtomValue } from "jotai";
import { stateUser } from "@/store/user";
import { customAlphabet } from "nanoid";
import { generateRandName } from "@/utils/random-name";
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

  const [isPassword, isUsername, isLink] = useMemo(() => {
    return [
      !!["密码", "password", "pwd"].find((text) =>
        value?.label?.toLowerCase().includes(text),
      ),
      !!["用户名", "名称", "name"].find((text) =>
        value?.label?.toLowerCase().includes(text),
      ),
      // 网址判定：协议头或 www. 开头（用户常省略协议头，如 www.baidu.com）
      !!value?.value &&
        (/^https?:\/\//i.test(value.value) ||
          /^www\.[^\s]+/i.test(value.value)),
    ];
  }, [value?.label, value?.value]);

  const onLabelChange = (val: string) => {
    onChange?.({ ...value, label: val } as CertificateField);
  };

  const onValueChange = (val: string) => {
    onChange?.({ ...value, value: val } as CertificateField);
  };

  const onCreatePassword = () => {
    // 空串也兜底为默认字符集：customAlphabet('') 会因字母表为空永远
    // 凑不满指定位数而死循环（曾致页面卡死）；用户存空串语义即用默认
    const alphabet = userInfo?.createPwdAlphabet || DEFAULT_PASSWORD_ALPHABET;
    const length = userInfo?.createPwdLength || DEFAULT_PASSWORD_LENGTH;
    const generate = customAlphabet(alphabet, +length);
    const newPassword = generate();

    onValueChange(newPassword);
    copy(newPassword);
    messageApi.success({ key: COPY_MESSAGE_KEY, content: "新密码已复制" });
  };

  const onCreateUsername = () => {
    const newName = generateRandName();
    onValueChange(newName);
    copy(newName);
    messageApi.success({ key: COPY_MESSAGE_KEY, content: "新名称已复制" });
  };

  const onFieldClick = () => {
    if (!disabled) return;
    if (!value || !value.value) return;

    // 网址字段与普通字段一致：点击复制（跳转由右侧独立按钮发起，
    // 避免误触直接离开应用）
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

    // 网址字段：输入框内右侧线框跳转 icon（类似密码框的眼睛）。
    // 网址必然单行，用 Input 而非 TextArea（TextArea 不支持 suffix）。
    // 无协议头的值（www.xxx.com）补 https:// 再打开，否则会被浏览器
    // 当相对路径解析成站内地址。点击 icon 需阻止冒泡，避免同时触发复制
    if (isLink) {
      const href = /^https?:\/\//i.test(value?.value ?? "")
        ? (value?.value ?? "")
        : `https://${value?.value ?? ""}`;
      return (
        <Input
          {...commonProps}
          suffix={
            disabled ? (
              <ExportOutlined
                className="text-gray-400 hover:text-sky-500 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  openNewTab(href);
                }}
              />
            ) : undefined
          }
        />
      );
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

        {/* 用户名生成 */}
        {!disabled && isUsername && (
          <Button
            className="ml-2 w-8 shrink-0 keep-antd-style !bg-sky-400"
            type="primary"
            icon={<GiftOutlined />}
            onClick={onCreateUsername}
          />
        )}

        {/* 密码生成 */}
        {!disabled && isPassword && (
          <Button
            className="ml-2 w-8 shrink-0 keep-antd-style !bg-sky-400"
            type="primary"
            icon={<GiftOutlined />}
            onClick={onCreatePassword}
          />
        )}

        {/* 删除按钮 */}
        {!disabled && showDelete && (
          <Button
            className="ml-2 w-8 shrink-0 keep-antd-style !bg-red-400"
            icon={<CloseOutlined />}
            type="primary"
            onClick={onDelete}
          />
        )}
      </div>
    </div>
  );
};

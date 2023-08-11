import { getRandName } from '@/client/services/certificate';
import { messageSuccess } from '@/client/utils/message';
import { STATUS_CODE } from '@/config';
import { CertificateField } from '@/types/certificate';
import { openNewTab } from '@/utils/common';
import { Input, Button, InputProps } from 'antd';
import copy from 'copy-to-clipboard';
import React, { FC, useMemo } from 'react';
import { CloseOutlined, GiftOutlined } from '@ant-design/icons';
import s from '../styles.module.css';
import { TextAreaProps } from 'antd/es/input';

interface CertificateFieldItemProps {
  showDelete?: boolean;
  value?: CertificateField;
  disabled?: boolean;
  onChange?: (value: CertificateField) => void;
  createPwd: (size?: number | undefined) => string;
  onDelete: () => void;
}

export const CertificateFieldItem: FC<CertificateFieldItemProps> = (props) => {
  const { value, onChange, onDelete, showDelete, disabled, createPwd } = props;

  const [isPassword, isUsername, isLink] = useMemo(() => {
    return [
      // 是否为密码输入框
      !!['密码', 'password', 'pwd'].find((text) => value?.label.includes(text)),
      // 是否为用户名输入框
      !!['用户名', '名称', 'name'].find((text) => value?.label.includes(text)),
      // 是否为链接
      !!['http://', 'https://'].find((text) => value?.value.includes(text)),
    ];
  }, [value?.label, value?.value]);

  const onLabelChange = (val: string) => {
    const newValue = { ...value, label: val };
    onChange?.(newValue as CertificateField);
  };

  const onValueChange = (val: string) => {
    const newValue = { ...value, value: val };
    onChange?.(newValue as CertificateField);
  };

  const onCreatePassword = () => {
    const newPassword = createPwd();
    onValueChange(newPassword);
    copy(newPassword);
    messageSuccess('新密码已复制');
  };

  const onCreateUsername = async () => {
    const resp = await getRandName();
    if (resp.code !== STATUS_CODE.SUCCESS) return;
    onValueChange(resp.data || '');
    copy(resp.data || '');
    messageSuccess('新名称已复制');
  };

  const onFieldClick = () => {
    // 编辑模式下点击文本框不会复制
    if (!disabled) return;

    if (!value || !value.value) {
      // messageWarning('内容为空')
      return;
    }

    if (isLink) {
      openNewTab(value.value);
      return;
    }
    copy(value.value);
    messageSuccess('已复制' + value.label);
  };

  const renderMainInput = () => {
    const commonProps: InputProps = {
      value: value?.value,
      onChange: undefined,
    };

    if (!disabled) {
      commonProps.onChange = (e) => onValueChange(e.target.value);
    } else {
      commonProps.onClick = onFieldClick;
      commonProps.className = s.fieldItemReadonly;
    }

    if (isPassword) {
      return <Input.Password {...commonProps}></Input.Password>;
    } else {
      return (
        <Input.TextArea
          {...(commonProps as TextAreaProps)}
          autoSize={{ minRows: 1, maxRows: 6 }}></Input.TextArea>
      );
    }
  };

  return (
    <div className='relative w-full'>
      <Input
        bordered={false}
        className={s.labelInput}
        size='small'
        value={value?.label}
        disabled={disabled}
        onChange={(e) => onLabelChange(e.target.value)}
      />
      <div className='flex'>
        {renderMainInput()}

        {/* 用户名生成 */}
        {!disabled && isUsername && (
          <Button
            className='ml-2 w-8 shrink-0 keep-antd-style !bg-sky-400'
            type='primary'
            icon={<GiftOutlined />}
            onClick={onCreateUsername}></Button>
        )}

        {/* 密码生成 */}
        {!disabled && isPassword && (
          <Button
            className='ml-2 w-8 shrink-0 keep-antd-style !bg-sky-400'
            type='primary'
            icon={<GiftOutlined />}
            onClick={onCreatePassword}></Button>
        )}

        {/* 删除按钮 */}
        {!disabled && showDelete && (
          <Button
            className='ml-2 w-8 shrink-0 keep-antd-style !bg-red-400'
            icon={<CloseOutlined />}
            type='primary'
            onClick={onDelete}></Button>
        )}
      </div>
    </div>
  );
};

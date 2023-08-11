import React, { FC, useState } from 'react';
import { Button, Form, Modal } from 'antd';
import { TitleInput } from './titleInput';
import { HeartFilled, QuestionCircleFilled } from '@ant-design/icons';
import { ColorPicker, MARK_COLORS_MAP } from '@/client/components/colorPicker';
import { messageWarning } from '@/client/utils/message';

interface UseTip {
  name: string;
  content: string;
}

const USE_TIPS: UseTip[] = [
  {
    name: '修改名称',
    content: '在编辑模式下，标题名和字段名均可修改。',
  },
  {
    name: '密码生成',
    content:
      '当字段名中包含 “密码”、“password”、“pwd” 时，将会显示密码生成按钮，点击后会生成 18 位的强密码并复制到剪切板。',
  },
  {
    name: '用户名',
    content:
      '当字段名中包含 “用户名”、“name” 时，将会显示用户名生成按钮，点击后会生成首字母大写的英文名并复制到剪切板。',
  },
  {
    name: '复制与跳转',
    content:
      '在查看凭证时，直接点击字段内容将会直接复制，如果内容以 http https 开头，将会直接跳转到对应网址。',
  },
];

interface ColorIconProps {
  disabled: boolean;
  value?: string;
  onChange?: (color: string) => void;
}

const ColorIcon: FC<ColorIconProps> = (props) => {
  /** 颜色选择器是否显示 */
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

  const onSelectedColor = (color: string) => {
    setIsColorPickerOpen(false);
    props?.onChange?.(color);
  };

  const onClick = () => {
    if (props.disabled) messageWarning('请先启用编辑');
    else setIsColorPickerOpen(true);
  };

  return (
    <div>
      <Button
        type='text'
        icon={
          <HeartFilled
            style={{ color: props?.value ? MARK_COLORS_MAP[props?.value] : '' }}
            className='text-xl text-gray-500 dark:text-gray-200'
          />
        }
        onClick={onClick}></Button>
      <ColorPicker
        onChange={onSelectedColor}
        visible={isColorPickerOpen}
        onClose={() => setIsColorPickerOpen(false)}
      />
    </div>
  );
};

interface DetailTitleProps {
  disabled: boolean;
}

export const DetailTitle: FC<DetailTitleProps> = (props) => {
  const { disabled } = props;
  // 操作帮助是否显示
  const [useTipVisible, setUseTipVisible] = useState(false);

  const renderUseTip = (item: UseTip) => {
    return (
      <div className='mb-4' key={item.name}>
        <div className='font-bold mb-1 dark:text-gray-400'>{item.name}</div>
        <div className='text-gray-600 dark:text-gray-200'>{item.content}</div>
      </div>
    );
  };

  return (
    <div className='w-100 flex flex-row flex-nowrap items-center'>
      <Form.Item noStyle name='title'>
        <TitleInput disabled={disabled} />
      </Form.Item>

      <div className='flex'>
        <Form.Item noStyle name='markColor'>
          <ColorIcon disabled={disabled} />
        </Form.Item>
        {!disabled && (
          <Button
            className='ml-2'
            type='text'
            icon={<QuestionCircleFilled className='text-xl text-gray-500 dark:text-gray-200' />}
            onClick={() => setUseTipVisible(true)}></Button>
        )}
      </div>

      <Modal
        open={useTipVisible}
        onCancel={() => setUseTipVisible(false)}
        footer={null}
        closable={false}>
        <div className='p-4'>{USE_TIPS.map(renderUseTip)}</div>
      </Modal>
    </div>
  );
};

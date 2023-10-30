import { Button, Input, Modal } from 'antd';
import React, { FC, PropsWithChildren } from 'react';
import s from './styles.module.css';

interface Props {
  value?: string;
  onChange?: (value: string) => void;
  visible: boolean;
  onClose: () => void;
}

export const IconPicker: FC<PropsWithChildren<Props>> = (props) => {
  const { value, onChange, visible, onClose } = props;

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      closable={false}
      width={200}
      className={s.container}>
      <div className='flex flex-col justify-center items-center'>
        <Input value={value} onChange={(e) => onChange?.(e.target.value)} placeholder='图标名' />
        <div className='my-4'>
          <i
            className={`${value || 'fa-solid fa-xmark'} ${
              value ? undefined : 'text-gray-300'
            } text-center text-[96px]`}
          />
        </div>
        <Button
          onClick={() => {
            window.open(
              'https://origin.fontawesome.com/search?o=r&m=free&f=brands%2Cclassic%2Csharp',
            );
          }}
          block
          className='mt-2'>
          查看图标列表
        </Button>
        <Button type='primary' block className='mt-2' onClick={onClose}>
          确定
        </Button>
      </div>
    </Modal>
  );
};

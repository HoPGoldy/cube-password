import React, { useState } from 'react';
import { useChangePasswordContent } from './content';
import { Modal } from 'antd';
import { useIsMobile } from '@/client/layouts/responsive';
import { MobilePageDrawer } from '@/client/components/mobileDrawer';
import { ActionButton } from '@/client/layouts/pageWithAction';

export const useChangePassword = () => {
  const isMobile = useIsMobile();
  /** 是否显示修改密码弹窗 */
  const [visible, setVisible] = useState(false);
  const { onSavePassword, renderContent } = useChangePasswordContent();

  /** 展示修改密码页面 */
  const showModal = () => {
    setVisible(true);
  };

  /** 渲染修改密码弹窗 */
  const renderModal = () => {
    if (isMobile) {
      return (
        <MobilePageDrawer
          open={visible}
          onClose={() => setVisible(false)}
          title='修改密码'
          content={renderContent()}
          action={<ActionButton onClick={() => setVisible(false)}>返回</ActionButton>}
        />
      );
    }

    return (
      <Modal
        open={visible}
        onCancel={() => setVisible(false)}
        onOk={async () => {
          const success = await onSavePassword();
          if (success) setVisible(false);
        }}
        title='修改密码'>
        {renderContent()}
      </Modal>
    );
  };

  return { showModal, renderModal };
};

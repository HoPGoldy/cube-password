import React, { useState } from 'react';
import { useContent } from './content';
import { Modal } from 'antd';
import { useIsMobile } from '@/client/layouts/responsive';
import { ActionButton } from '@/client/layouts/pageWithAction';
import { MobilePageDrawer } from '@/client/components/mobileDrawer';

export const useOtpConfig = () => {
  const isMobile = useIsMobile();
  /** 是否显示修改密码弹窗 */
  const [visible, setVisible] = useState(false);
  const { onSave, renderContent } = useContent();

  /** 展示配置 */
  const showModal = () => {
    setVisible(true);
  };

  /** 渲染配置弹窗 */
  const renderModal = () => {
    if (isMobile) {
      return (
        <MobilePageDrawer
          open={visible}
          onClose={() => setVisible(false)}
          title='动态验证码管理'
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
          const success = await onSave();
          if (success) setVisible(false);
        }}
        title='动态验证码管理'>
        {renderContent()}
      </Modal>
    );
  };

  return { showModal, renderModal };
};

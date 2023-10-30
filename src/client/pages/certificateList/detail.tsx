import React, { FC, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Form, Modal, Watermark } from 'antd';
import { PlusOutlined, ExclamationCircleFilled } from '@ant-design/icons';
import { messageError, messageSuccess, messageWarning } from '@/client/utils/message';
import { useCertificateDetail, useSaveCertificate } from '@/client/services/certificate';
import { DEFAULT_PASSWORD_ALPHABET, DEFAULT_PASSWORD_LENGTH } from '@/config';
import { customAlphabet } from 'nanoid';
import { DetailTitle } from './components/detailTitle';
import { aes, aesDecrypt } from '@/utils/crypto';
import { useAtomValue } from 'jotai';
import { stateMainPwd, stateUser } from '@/client/store/user';
import { CertificateFieldItem } from './components/certificateFieldItem';
import copy from 'copy-to-clipboard';
import { CertificateField } from '@/types/certificate';
import { useIsMobile } from '@/client/layouts/responsive';
import { Draggable } from '@/client/components/draggable';
import dayjs from 'dayjs';

interface Props {
  groupId: number;
  detailId: number | undefined;
  onCancel: () => void;
}

const getNewFormValues = () => {
  return {
    title: '新密码',
    icon: 'fa-solid fa-key',
    markColor: '',
    fields: [
      {
        label: '网址',
        value: '',
      },
      {
        label: '用户名',
        value: '',
      },
      {
        label: '密码',
        value: '',
      },
    ],
  };
};

/**
 * 凭证详情
 */
export const CertificateDetail: FC<Props> = (props) => {
  const { detailId, onCancel } = props;
  const [form] = Form.useForm();
  const userInfo = useAtomValue(stateUser);
  const isMobile = useIsMobile();
  const { pwdKey, pwdIv } = useAtomValue(stateMainPwd);
  /** 是否可以编辑 */
  const [readonly, setReadonly] = useState(true);
  /** 新建字段时的累加字段名索引 */
  const newFieldIndex = useRef(1);
  /** 获取凭证详情 */
  const { data: detailResp } = useCertificateDetail(detailId);
  /** 保存凭证详情 */
  const { mutateAsync: saveDetail, isLoading: isSaving } = useSaveCertificate(detailId);

  useEffect(() => {
    if (!detailId) return;
    const isAdd = detailId === -1;
    if (isAdd) form.setFieldsValue(getNewFormValues());
    setReadonly(!isAdd);
  }, [detailId]);

  useEffect(() => {
    if (!detailResp || !detailResp.data) return;
    if (!pwdKey || !pwdIv) return;

    const { content, name, markColor, icon } = detailResp.data;
    try {
      const fields = JSON.parse(aesDecrypt(content, pwdKey, pwdIv));
      const values = {
        title: name,
        markColor: markColor || '',
        icon,
        fields,
      };

      form.setFieldsValue(values);
    } catch (e) {
      console.error(e);
      messageError('凭证解密失败');
      onCancel();
    }
  }, [detailResp]);

  const createPwd = useMemo(() => {
    return customAlphabet(
      userInfo?.createPwdAlphabet ?? DEFAULT_PASSWORD_ALPHABET,
      userInfo?.createPwdLength ?? DEFAULT_PASSWORD_LENGTH,
    );
  }, [userInfo?.createPwdAlphabet, userInfo?.createPwdLength]);

  const onConfirm = async () => {
    const values = await form.validateFields();
    if (!values.title) {
      messageWarning('标题不能为空');
      return;
    }

    if (!pwdKey || !pwdIv) {
      messageWarning('主密码错误，请尝试重新登录');
      return;
    }
    const content = aes(JSON.stringify(values.fields), pwdKey, pwdIv);

    await saveDetail({
      name: values.title,
      markColor: values.markColor,
      icon: values.icon,
      content,
      groupId: props.groupId,
      order: 0,
    });

    messageSuccess('保存成功');
    onCancel();
  };

  /** 复制完整凭证内容 */
  const onCopyTotal = () => {
    Modal.confirm({
      title: '确定要复制完整凭证？',
      icon: <ExclamationCircleFilled />,
      content: '所有加密信息都将以明文展示，请确保索要凭证的人值得信赖。',
      onOk: async () => {
        const formData = form.getFieldsValue();

        let content = formData.title + '\n\n';
        formData.fields?.map((field: CertificateField) => {
          content += field.label + '\n' + field.value + '\n\n';
        });

        copy(content);
        messageSuccess('凭证已复制');
      },
    });
  };

  const renderModalFooter = () => {
    const btns = [
      <Button key='back' onClick={onCancel} size={isMobile ? 'large' : 'middle'}>
        返回
      </Button>,
    ];

    if (readonly) {
      btns.push(
        <Button
          key='copy'
          onClick={onCopyTotal}
          loading={isSaving}
          size={isMobile ? 'large' : 'middle'}>
          复制
        </Button>,
        <Button
          key='edit'
          type='primary'
          onClick={() => setReadonly(false)}
          loading={isSaving}
          size={isMobile ? 'large' : 'middle'}>
          编辑
        </Button>,
      );
    } else {
      btns.push(
        <Button
          key='save'
          type='primary'
          onClick={onConfirm}
          loading={isSaving}
          size={isMobile ? 'large' : 'middle'}>
          保存
        </Button>,
      );
    }

    return btns;
  };

  const renderCertificateDetail = () => {
    return (
      <Form form={form}>
        <Modal
          open={!!detailId}
          onCancel={onCancel}
          closable={false}
          title={
            <DetailTitle disabled={readonly} certificateId={detailId || 0} onCancel={onCancel} />
          }
          footer={renderModalFooter()}
          modalRender={(node) => {
            if (!readonly) return node;
            return (
              <Watermark
                content={[detailResp?.data?.name ?? '-', dayjs().format('YYYY-MM-DD HH:mm:ss')]}
                gap={[100, 40]}>
                {node}
              </Watermark>
            );
          }}>
          {renderDetailForm()}
        </Modal>
      </Form>
    );
  };

  const renderDetailForm = () => {
    return (
      <Form.List name='fields'>
        {(fields, { add, remove, move }) => (
          <>
            <Draggable
              value={fields}
              sortableOptions={{ disabled: readonly, handle: '.move-handle' }}
              renderItem={(field) => (
                // eslint-disable-next-line react/jsx-key
                <Form.Item {...field} noStyle>
                  <CertificateFieldItem
                    disabled={readonly}
                    showDelete={fields.length > 1}
                    createPwd={createPwd}
                    onDelete={() => remove(field.name)}
                  />
                </Form.Item>
              )}
              onChange={(list, oldIndex, newIndex) => {
                move(oldIndex as number, newIndex as number);
              }}
            />
            {!readonly ? (
              <Form.Item key='add'>
                <Button
                  type='dashed'
                  onClick={() => add({ label: '字段' + newFieldIndex.current++, value: '' })}
                  block
                  className='mt-4'
                  icon={<PlusOutlined />}>
                  新增字段
                </Button>
              </Form.Item>
            ) : (
              <div key='bottom' className='mt-6'></div>
            )}
          </>
        )}
      </Form.List>
    );
  };

  return renderCertificateDetail();
};

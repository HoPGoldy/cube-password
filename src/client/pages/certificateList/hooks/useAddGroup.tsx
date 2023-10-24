import { useIsMobile } from '@/client/layouts/responsive';
import { rebuildGroup, stateGroupList } from '@/client/store/group';
import { messageSuccess } from '@/client/utils/message';
import { sha } from '@/utils/crypto';
import { Form, Row, Col, Input, Modal, Segmented } from 'antd';
import React, { useState } from 'react';
import { useAddGroup } from '@/client/services/group';
import { nanoid } from 'nanoid';
import { CertificateGroupStorage, LockType } from '@/types/group';
import { useSetAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { useLockTypeOptions } from './useLockTypeOptions';

export const useAddGroupContent = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { mutateAsync: runAddGroup, isLoading: submitting } = useAddGroup();
  /** 是否显示新增弹窗 */
  const [showAddModal, setShowAddModal] = useState(false);
  /** 当前显示的分组列表 */
  const setGroupList = useSetAtom(stateGroupList);
  const lockType = Form.useWatch('lockType', form);
  const lockTypeOptions = useLockTypeOptions();

  const onClickSave = async () => {
    const values = await form.validateFields();
    const salt = nanoid(128);

    const postData: Omit<CertificateGroupStorage, 'id'> = {
      name: values.name,
      order: 0,
      lockType: values.lockType,
      passwordHash: values.password ? sha(salt + values.password) : undefined,
      passwordSalt: values.password ? salt : undefined,
    };

    const resp = await runAddGroup(postData);
    if (resp.code !== 200 || !resp.data) return;

    messageSuccess('分组添加成功');
    setShowAddModal(false);
    setGroupList(resp.data.newList?.map(rebuildGroup) ?? []);
    navigate(`/group/${resp.data.newId}`);
    form.resetFields();
  };

  const renderContent = () => {
    return (
      <Modal
        title='新建分组'
        open={showAddModal}
        okButtonProps={{ loading: submitting }}
        onOk={onClickSave}
        onCancel={() => setShowAddModal(false)}>
        <Form
          className='better-form'
          form={form}
          labelCol={{ span: 6 }}
          labelAlign='right'
          size={isMobile ? 'large' : 'middle'}
          initialValues={{ lockType: LockType.None }}>
          <Row className='md:mt-6'>
            <Col span={24}>
              <Form.Item
                label='分组名称'
                name='name'
                rules={[{ required: true, message: '分组名称不得为空' }]}>
                <Input placeholder='请输入分组名' />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label='加密方式' name='lockType'>
                <Segmented block options={lockTypeOptions} />
              </Form.Item>
            </Col>
            {lockType === LockType.Password && (
              <>
                <Col span={24}>
                  <Form.Item
                    label='分组密码'
                    name='password'
                    hasFeedback
                    rules={[{ required: true, message: '请输入密码' }]}>
                    <Input.Password placeholder='请输入' />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item
                    label='重复密码'
                    name='passwordConfirm'
                    rules={[
                      { required: true, message: '请重复分组密码' },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue('password') === value) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error('与分组密码不一致'));
                        },
                      }),
                    ]}>
                    <Input.Password placeholder='请输入' />
                  </Form.Item>
                </Col>
              </>
            )}
          </Row>
        </Form>
      </Modal>
    );
  };

  return { setShowAddModal, renderContent };
};

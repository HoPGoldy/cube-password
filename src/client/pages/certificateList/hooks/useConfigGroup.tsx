import { useIsMobile } from '@/client/layouts/responsive';
import { stateUser } from '@/client/store/user';
import { rebuildGroup, useGroup } from '@/client/store/group';
import { messageSuccess, messageWarning } from '@/client/utils/message';
import { Form, Row, Col, Input, Modal, Segmented, Button, Space, Result } from 'antd';
import React, { useEffect, useState } from 'react';
import {
  useDeleteGroup,
  useUpdateDefaultGroup,
  useUpdateGroupConfig,
} from '@/client/services/group';
import { LockType } from '@/types/group';
import { useAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { DeleteOutlined, WarningOutlined } from '@ant-design/icons';
import { nanoid } from 'nanoid';
import { sha } from '@/utils/crypto';
import { useLockTypeOptions } from './useLockTypeOptions';

interface UseConfigGroupContentProps {
  groupId: number;
}

export const useConfigGroupContent = (props: UseConfigGroupContentProps) => {
  const { groupId } = props;
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [userInfo, setUserInfo] = useAtom(stateUser);
  const { group, updateGroup, deleteGroup } = useGroup(groupId);
  const { mutateAsync: runDeleteGroup, isLoading: deleting } = useDeleteGroup(groupId);
  const { mutateAsync: runUpdateDefault, isLoading: updateDefaultLoading } =
    useUpdateDefaultGroup(groupId);
  const { mutateAsync: runUpdateConfig, isLoading: updateConfigLoading } =
    useUpdateGroupConfig(groupId);
  /** 是否显示新增弹窗 */
  const [showModal, setShowModal] = useState(false);
  /** 更新前的分组加密类型 */
  const [prevLockType, setPrevLockType] = useState<LockType>();
  /** 当前选中的分组加密类型 */
  const lockType = Form.useWatch('lockType', form);
  /** 是否显示删除确认弹窗 */
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  /** 删除确认输入框内容 */
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  /** 本分组是否为默认分组 */
  const isDefaultGroup = userInfo?.defaultGroupId === groupId;
  const lockTypeOptions = useLockTypeOptions();

  useEffect(() => {
    if (!group) return;
    setPrevLockType(group.lockType);
    form.setFieldsValue({ lockType: group.lockType });
  }, [group]);

  const onCancelModal = () => {
    setShowModal(false);
    form.resetFields();
  };

  const onSetDefaultGroup = async () => {
    const resp = await runUpdateDefault();
    if (resp.code !== 200) return;

    messageSuccess('默认分组设置成功');
    setUserInfo((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        defaultGroupId: groupId,
      };
    });
  };

  const onShowDeleteConfirm = () => {
    setShowDeleteConfirm(true);
  };

  const onCancelDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    setDeleteConfirmInput('');
  };

  const onDeleteGroup = async () => {
    if (deleteConfirmInput !== group?.name) {
      messageWarning('分组名称不正确');
      onCancelDeleteConfirm();
      return;
    }

    const resp = await runDeleteGroup();
    if (resp.code !== 200 || !resp.data) {
      onCancelDeleteConfirm();
      return;
    }

    const newDefaultGroupId = resp.data;

    onCancelDeleteConfirm();
    onCancelModal();

    messageSuccess('分组删除成功');
    navigate(`/group/${newDefaultGroupId}`);

    deleteGroup();
    setUserInfo((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        defaultGroupId: newDefaultGroupId,
      };
    });
  };

  const onSaveConfig = async () => {
    const values = await form.validateFields();
    const salt = nanoid(128);

    const resp = await runUpdateConfig({
      lockType: values.lockType,
      passwordHash: values.password ? sha(salt + values.password) : undefined,
      passwordSalt: values.password ? salt : undefined,
    });
    if (resp.code !== 200) return;

    messageSuccess('保存成功');
    onCancelModal();
    updateGroup(rebuildGroup(resp.data));
  };

  const renderConfigContent = () => {
    return (
      <>
        <Modal
          title='分组配置'
          open={showModal}
          onCancel={onCancelModal}
          footer={
            <Space>
              <Button icon={<DeleteOutlined />} danger onClick={onShowDeleteConfirm}>
                删除
              </Button>
              <Button
                disabled={isDefaultGroup}
                onClick={onSetDefaultGroup}
                loading={updateDefaultLoading}>
                {isDefaultGroup ? '默认分组' : '设为默认分组'}
              </Button>
              <Button onClick={onSaveConfig} type='primary' loading={updateConfigLoading}>
                保存
              </Button>
            </Space>
          }>
          <Form
            className='better-form'
            form={form}
            labelCol={{ span: 6 }}
            labelAlign='right'
            size={isMobile ? 'large' : 'middle'}
            initialValues={{ lockType: LockType.None }}>
            <Row className='md:mt-6'>
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
                      rules={[
                        { required: prevLockType !== LockType.Password, message: '请填写分组密码' },
                      ]}>
                      <Input.Password placeholder='请输入' />
                    </Form.Item>
                  </Col>
                  <Col span={24}>
                    <Form.Item
                      label='重复密码'
                      name='passwordConfirm'
                      rules={[
                        { required: prevLockType !== LockType.Password, message: '请重复分组密码' },
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
        <Modal
          open={showDeleteConfirm}
          closable={false}
          okText='删除'
          width={400}
          onCancel={onCancelDeleteConfirm}
          footer={false}>
          <Result
            className='p-0'
            icon={<WarningOutlined className='!text-yellow-400' />}
            title='分组删除确认'
            subTitle={
              <div className='text-black'>
                分组删除后，其中的凭证将被 <b>一并删除</b> 且无法恢复，如果确定要删除，请在下方输入“
                {group?.name}”
              </div>
            }
            extra={
              <div>
                <div className='w-full'>
                  <Row gutter={[8, 8]}>
                    <Col span={24}>
                      <Input
                        placeholder='请输入分组名称'
                        value={deleteConfirmInput}
                        onChange={(e) => {
                          setDeleteConfirmInput(e.target.value);
                        }}
                        onKeyUp={(e) => {
                          if (e.key === 'Enter') onDeleteGroup();
                        }}
                      />
                    </Col>
                    <Col span={12}>
                      <Button block onClick={onCancelDeleteConfirm}>
                        返回
                      </Button>
                    </Col>
                    <Col span={12}>
                      <Button
                        type='primary'
                        danger
                        block
                        onClick={onDeleteGroup}
                        loading={deleting}>
                        删除
                      </Button>
                    </Col>
                  </Row>
                </div>
              </div>
            }
          />
        </Modal>
      </>
    );
  };

  return { setShowModal, renderConfigContent };
};

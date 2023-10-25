import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ActionButton, ActionIcon } from '@/client/layouts/pageWithAction';
import { messageSuccess, messageWarning } from '@/client/utils/message';
import {
  RetweetOutlined,
  CheckSquareOutlined,
  CloseOutlined,
  PlusOutlined,
  SettingOutlined,
  SearchOutlined,
  UnorderedListOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { MobileSetting } from '../setting';
import s from './styles.module.css';
import { Button, Col, Drawer, Dropdown, Row, Space } from 'antd';
import { MobileDrawer } from '@/client/components/mobileDrawer';
import { DesktopArea } from '@/client/layouts/responsive';
import { useConfigGroupContent } from './hooks/useConfigGroup';
import { CertificateListItem } from '@/types/group';
import { useAtomValue } from 'jotai';
import { GroupDetail, stateGroupList, useGroup } from '@/client/store/group';
import { useMoveCertificate } from '@/client/services/certificate';
import { useAddGroupContent } from './hooks/useAddGroup';
import { CSSTransition } from 'react-transition-group';

interface Props {
  certificateList: CertificateListItem[];
  onAddNew: () => void;
  groupId: number;
  onLogin: () => void;
  isLoginGroup: boolean;
}

/**
 * 当前选择模式的类型
 */
export enum SelectModeType {
  /**
   * 点击移动分组开启的选择模式
   */
  Move = 'move',
}

export const useOperation = (props: Props) => {
  const { groupId, certificateList } = props;
  const groupList = useAtomValue(stateGroupList);
  /** 接口 - 移动凭证 */
  const { mutateAsync: runMoveCertificate } = useMoveCertificate();
  /** 是否展示设置 */
  const [showSetting, setShowSetting] = useState(false);
  /** 是否显示月份选择器 */
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  /** 功能 - 分组配置 */
  const { renderConfigContent, setShowModal: setShowConfigModal } = useConfigGroupContent({
    groupId,
  });
  /** 选择模式 */
  const [selectMode, setSelectMode] = useState<SelectModeType | null>(null);
  /** 是否显示移动端批量操作弹窗 */
  const [showMobileSelect, setShowMobileSelect] = useState(false);
  // 被选中的凭证
  const [selectedItem, setSelectedItem] = useState<Record<number, boolean>>({});
  /** 分组列表 */
  const groups = useAtomValue(stateGroupList);
  /** 新增分组 */
  const addGroup = useAddGroupContent();
  /** 分组是否解密了 */
  const { group } = useGroup(groupId);

  useEffect(() => {
    closeSelectMode();
  }, [groupId]);

  /** 渲染分组选择器 */
  const renderGroupPicker = () => {
    return (
      <MobileDrawer
        title='分组选择'
        open={showGroupPicker}
        onClose={() => setShowGroupPicker(false)}
        height='22rem'
        footer={
          <Button
            className={`${s.toolBtn} keep-antd-style`}
            icon={<PlusOutlined />}
            size='large'
            block
            onClick={() => addGroup.setShowAddModal(true)}>
            新建分组
          </Button>
        }>
        <div className='flex-grow flex-shrink overflow-y-auto noscrollbar overflow-x-hidden my-3'>
          <Space direction='vertical' style={{ width: '100%' }}>
            {groups.map(renderGroupItem)}
          </Space>
        </div>
        {addGroup.renderContent()}
      </MobileDrawer>
    );
  };

  const renderGroupItem = (item: GroupDetail) => {
    const isActive = groupId && +groupId === item.id;

    return (
      <Link key={item.id} to={`/group/${item.id}`}>
        <Button
          block
          type={isActive ? 'primary' : 'default'}
          size='large'
          onClick={() => setShowGroupPicker(false)}>
          {item.unlocked ? undefined : <LockOutlined />}

          {item.name}
          <span className='truncate'></span>
        </Button>
      </Link>
    );
  };

  /** 渲染移动端的底部操作栏 */
  const renderMobileBar = () => {
    return (
      <>
        {renderGroupPicker()}
        <Drawer
          open={showSetting}
          onClose={() => setShowSetting(false)}
          closable={false}
          placement='left'
          className={s.settingDrawer}
          width='100%'>
          <MobileSetting onBack={() => setShowSetting(false)} />
        </Drawer>
        <ActionIcon icon={<SettingOutlined />} onClick={() => setShowSetting(true)} />
        <ActionIcon icon={<UnorderedListOutlined />} onClick={() => setShowGroupPicker(true)} />
        <Link to='/search'>
          <ActionIcon icon={<SearchOutlined />} />
        </Link>
        {group?.unlocked ? (
          <ActionButton onClick={() => props.onAddNew()}>新建密码</ActionButton>
        ) : (
          <ActionButton onClick={() => props.onLogin()} loading={props.isLoginGroup}>
            解锁分组
          </ActionButton>
        )}
      </>
    );
  };

  const closeSelectMode = () => {
    setSelectMode(null);
    setSelectedItem({});
  };

  const onMoveCertificate = async (newGroupId: number) => {
    const ids = Object.keys(selectedItem)
      .filter((key) => selectedItem[+key])
      .map(Number);

    if (ids.length === 0) {
      messageWarning('请选择至少一个凭证');
      return;
    }

    const resp = await runMoveCertificate({
      newGroupId,
      ids,
    });
    if (resp.code !== 200) return;

    messageSuccess('移动成功');
    closeSelectMode();
  };

  const getMoveTarget = () => {
    if (!groupList) return [];

    return groupList
      .filter((group) => group.id !== groupId)
      .map((group) => {
        return {
          key: group.id,
          label: group.name,
          onClick: () => onMoveCertificate(group.id),
        };
      });
  };

  const renderMoveBtn = () => {
    if (!groupList || groupList.length <= 1 || certificateList.length <= 0) return null;

    if (!selectMode)
      return (
        <Button
          key='move'
          icon={<RetweetOutlined />}
          onClick={() => setSelectMode(SelectModeType.Move)}>
          移动凭证
        </Button>
      );

    if (selectMode === SelectModeType.Move)
      return (
        <>
          <Dropdown menu={{ items: getMoveTarget() }}>
            <Button key='moveTo' type='primary' icon={<RetweetOutlined />}>
              移动至
            </Button>
          </Dropdown>
          <Button key='cancelMove' icon={<CloseOutlined />} onClick={closeSelectMode}>
            取消移动
          </Button>
        </>
      );

    return null;
  };

  const transitionRef = useRef(null);
  const renderMobileMoveBtn = () => {
    return (
      <CSSTransition
        in={selectMode === SelectModeType.Move}
        nodeRef={transitionRef}
        timeout={300}
        classNames='batch-modal'
        onEnter={() => setShowMobileSelect(true)}
        onExited={() => setShowMobileSelect(false)}>
        <Row gutter={[8, 8]} ref={transitionRef}>
          {showMobileSelect && (
            <>
              <Col span={12}>
                <Dropdown menu={{ items: getMoveTarget() }}>
                  <Button key='moveTo' icon={<RetweetOutlined />} block size='large'>
                    移动至
                  </Button>
                </Dropdown>
              </Col>
              <Col span={12}>
                <Button
                  key='cancelMove'
                  icon={<CloseOutlined />}
                  onClick={closeSelectMode}
                  block
                  size='large'>
                  取消移动
                </Button>
              </Col>
            </>
          )}
        </Row>
      </CSSTransition>
    );
  };

  const renderAddBtn = () => {
    if (selectMode) return null;

    return (
      <Button key='add' type='primary' icon={<PlusOutlined />} onClick={props.onAddNew}>
        新建密码
      </Button>
    );
  };

  /**
   * 渲染反选按钮
   * 反选只在选择模式下才会出现，用于反选当前已选中的凭证
   */
  const renderReverseBtn = () => {
    if (!selectMode) return null;

    const onSwitchAllItem = () => {
      if (!certificateList) return;
      const newSelectedItem: Record<number, boolean> = {};
      certificateList.forEach((item) => {
        newSelectedItem[item.id] = !selectedItem[item.id];
      });
      setSelectedItem(newSelectedItem);
    };

    return (
      <Button key='reverse' icon={<CheckSquareOutlined />} onClick={onSwitchAllItem}>
        反选
      </Button>
    );
  };

  /** PC 端渲染顶部操作栏 */
  const renderTitleOperation = () => {
    return (
      <DesktopArea>
        <div className='flex flex-row flex-nowrap justify-end items-center'>
          <Space>
            <Button
              key='config'
              icon={<SettingOutlined />}
              onClick={() => setShowConfigModal(true)}>
              分组配置
            </Button>
            {renderMoveBtn()}
            {renderReverseBtn()}
            {renderAddBtn()}
          </Space>
        </div>
        {renderConfigContent()}
      </DesktopArea>
    );
  };

  const renderMobileTitleOperation = () => {
    return (
      <>
        <Button
          icon={<SettingOutlined />}
          type='text'
          onClick={() => setShowConfigModal(true)}></Button>
        {renderConfigContent()}
      </>
    );
  };

  return {
    selectedItem,
    setSelectedItem,
    selectMode,
    setSelectMode,
    renderMobileBar,
    renderMobileMoveBtn,
    renderTitleOperation,
    renderMobileTitleOperation,
  };
};

import React, { FC, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { RightOutlined, PlusOutlined, LockOutlined } from '@ant-design/icons';
import { Button, Space } from 'antd';
import s from './styles.module.css';
import { useAtom } from 'jotai';
import { GroupDetail, stateGroupList } from '@/client/store/group';
import { useAddGroupContent } from '@/client/pages/certificateList/hooks/useAddGroup';
import { Draggable } from '@/client/components/draggable';
import { useUpdateGroupSort } from '@/client/services/group';

export const Sidebar: FC = () => {
  /** 分组列表 */
  const [groups, setGroups] = useAtom(stateGroupList);
  /** 当前所处的分组 */
  const { groupId } = useParams();
  /** 新增分组 */
  const addGroup = useAddGroupContent();
  const { mutateAsync: updateGroupSort } = useUpdateGroupSort();
  const [dragging, setDragging] = useState(false);

  const renderGroupItem = (item: GroupDetail) => {
    const className = [s.menuItem];
    if (groupId && +groupId === item.id) className.push(s.menuItemActive);

    return (
      <div key={item.id} className={`${s.itemWrap} ${dragging ? s.itemWrapDrag : ''}`}>
        <Link to={`/group/${item.id}`}>
          <div className={className.join(' ')} title={item.name}>
            <span className='truncate'>{item.name}</span>
            {item.unlocked ? <RightOutlined /> : <LockOutlined />}
          </div>
        </Link>
      </div>
    );
  };

  return (
    <section className={s.sideberBox}>
      <div className='flex flex-row flex-nowrap items-center justify-center'>
        <div className='font-black text-lg'>密码本</div>
      </div>

      <div className='flex-grow flex-shrink overflow-y-auto noscrollbar overflow-x-hidden my-3'>
        <Space direction='vertical' style={{ width: '100%' }}>
          <Draggable
            className='w-full'
            value={groups}
            sortableOptions={{
              onStart: () => setDragging(true),
              onEnd: () => setDragging(false),
            }}
            renderItem={renderGroupItem}
            onChange={(list) => {
              setGroups(list);
              updateGroupSort(list.map((i) => i.id));
            }}
          />
        </Space>
      </div>

      <Button
        className={`${s.toolBtn} keep-antd-style`}
        icon={<PlusOutlined />}
        block
        onClick={() => addGroup.setShowAddModal(true)}>
        新建分组
      </Button>
      {addGroup.renderContent()}
    </section>
  );
};

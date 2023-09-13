import { useUpdateGroupName } from '@/client/services/group';
import { useGroup } from '@/client/store/group';
import { Input } from 'antd';
import React, { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';

const pageTitle: Record<string, string> = {
  '/exportDiary': '导出笔记',
  '/importDiary': '导入笔记',
  '/search': '搜索凭证',
  '/userInvite': '用户管理',
  '/about': '关于',
};

export const usePageTitle = () => {
  const { pathname } = useLocation();
  const params = useParams();

  const groupId = Number(params.groupId);
  const { group, updateGroup } = useGroup(groupId);
  /** 当前显示的分组标题 */
  const [groupTitle, setGroupTitle] = useState<string>();
  const { mutateAsync: runSaveName, isLoading: isSaving } = useUpdateGroupName(groupId);

  useEffect(() => {
    if (!groupId || !group) return;
    setGroupTitle(group?.name);
  }, [group]);

  const getTitle = () => {
    if (pathname in pageTitle) return pageTitle[pathname];
    return '';
  };

  const onSaveTitle = async () => {
    if (!groupId || !group) return;
    if (groupTitle === group.name) return;
    if (!groupTitle) {
      setGroupTitle(group.name);
      return;
    }

    const resp = await runSaveName(groupTitle);
    if (resp.code !== 200) return;

    updateGroup({ name: groupTitle });
  };

  const renderTtitle = () => {
    if (groupId) {
      return (
        <Input
          className='text-lg pl-0'
          bordered={false}
          value={groupTitle}
          onChange={(e) => setGroupTitle(e.target.value)}
          onBlur={onSaveTitle}
          onKeyUp={(e) => {
            if (e.key === 'Enter') (e.target as HTMLElement).blur();
          }}
          disabled={isSaving}
        />
      );
    }

    return <div className='text-lg cursor-default'>{getTitle()}</div>;
  };

  return renderTtitle;
};

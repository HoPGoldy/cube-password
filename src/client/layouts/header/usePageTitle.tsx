import { useUpdateGroupName } from '@/client/services/group';
import { stateGroupList, useGroupInfo } from '@/client/store/user';
import { Input } from 'antd';
import { useSetAtom } from 'jotai';
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
  const groupInfo = useGroupInfo(groupId);
  /** 当前显示的分组标题 */
  const [groupTitle, setGroupTitle] = useState<string>();
  const { mutateAsync: runSaveName, isLoading: isSaving } = useUpdateGroupName(groupId);
  const setGroupList = useSetAtom(stateGroupList);

  useEffect(() => {
    if (!groupId || !groupInfo) return;
    setGroupTitle(groupInfo?.name);
  }, [groupInfo]);

  const getTitle = () => {
    if (pathname in pageTitle) return pageTitle[pathname];
    return '';
  };

  const onSaveTitle = async () => {
    if (!groupId || !groupInfo) return;
    if (groupTitle === groupInfo.name) return;
    if (!groupTitle) {
      setGroupTitle(groupInfo.name);
      return;
    }

    const resp = await runSaveName(groupTitle);
    if (resp.code !== 200) return;

    setGroupList((prev) => {
      const index = prev.findIndex((item) => item.id === groupId);
      const newGroupList = [...prev];
      newGroupList[index] = { ...newGroupList[index], name: groupTitle };
      return newGroupList;
    });
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

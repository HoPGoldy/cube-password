import React, { FC, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageContent, PageAction } from '../../layouts/pageWithAction';
import Loading from '../../layouts/loading';
import { Button, Card, Empty, Result } from 'antd';
import { PageTitle } from '@/client/components/pageTitle';
import { useOperation } from './operation';
import { CertificateDetail } from './detail';
import { useCertificateList } from '@/client/services/certificate';
import { CertificateListItem } from '@/types/group';
import { useGroup } from '@/client/store/group';
import { useGroupLock } from './hooks/useGroupLock';
import { CertificateListDetail } from './components/certificateListItem';
import { MobileArea, useIsMobile } from '@/client/layouts/responsive';
import { usePageTitle } from '@/client/layouts/header/usePageTitle';

/**
 * 凭证列表
 */
const CertificateList: FC = () => {
  const isMobile = useIsMobile();
  const { groupId: groupIdStr } = useParams();
  const groupId = Number(groupIdStr);
  const renderTitle = usePageTitle();
  /** 详情弹窗展示的密码 ID（-1 时代表新增密码） */
  const [detailId, setDetailId] = useState<number>();
  /** 分组是否解密了 */
  const { group } = useGroup(groupId);
  /** 获取凭证列表 */
  const { data: certificateListResp, isLoading } = useCertificateList(groupId, !!group?.unlocked);
  /** 分组登录功能 */
  const { renderGroupLogin, onLogin, isLoginGroup } = useGroupLock({ groupId });
  /** 操作栏功能 */
  const operation = useOperation({
    certificateList: certificateListResp?.data ?? [],
    onAddNew: () => setDetailId(-1),
    groupId,
    onLogin,
    isLoginGroup,
  });

  if (!groupId || !group)
    return (
      <Result
        status='warning'
        title='未知分组'
        subTitle='请检查链接是否正确，或者点击下方按钮返回默认分组'
        extra={
          <Link to='/'>
            <Button key='console'>返回首页</Button>
          </Link>
        }
      />
    );

  const renderCertificateItem = (item: CertificateListItem) => {
    return (
      <CertificateListDetail
        key={item.id}
        detail={item}
        isSelected={!!operation.selectedItem[item.id]}
        selectMode={!!operation.selectMode}
        onClick={() => {
          if (!operation.selectMode) setDetailId(item.id);
          else operation.setSelectedItem((old) => ({ ...old, [item.id]: !old[item.id] }));
        }}
      />
    );
  };

  const renderList = () => {
    if (!certificateListResp?.data || certificateListResp?.data?.length === 0) {
      return (
        <Empty
          className='m-auto mt-[20vh]'
          description={
            <div className='text-gray-500 cursor-default'>
              暂无凭证，点击{isMobile ? '右下角' : '右上角'}按钮创建
            </div>
          }
        />
      );
    }

    return certificateListResp?.data?.map(renderCertificateItem);
  };

  const renderContent = () => {
    if (!group?.unlocked) return renderGroupLogin();
    if (isLoading) return <Loading />;

    return (
      <div className='mx-4 mt-4'>
        {operation.renderTitleOperation()}
        <div className='mt-4 flex flex-wrap justify-start'>{renderList()}</div>
      </div>
    );
  };

  return (
    <>
      <PageTitle title='凭证列表' />

      <PageContent>
        <MobileArea>
          <Card size='small' className='text-base m-4'>
            <div className='flex items-center'>
              <div className='flex-1'>{renderTitle()}</div>
              {operation.renderMobileTitleOperation()}
            </div>
          </Card>
        </MobileArea>
        {renderContent()}
        <CertificateDetail
          groupId={+groupId}
          detailId={detailId}
          onCancel={() => setDetailId(undefined)}
        />
      </PageContent>

      <PageAction>{operation.renderMobileBar()}</PageAction>
    </>
  );
};

export default CertificateList;

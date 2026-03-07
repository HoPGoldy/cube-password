import { FC, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAtom } from "jotai";
import { stateGroupList } from "@/store/user";
import { useCertificateList } from "@/services/certificate";
import { GroupUnlock } from "./components/group-unlock";
import { CertificateDetailModal } from "./components/certificate-detail";
import { CertificateListItem } from "./components/certificate-list-item";
import { Button, Empty, Result, Spin } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useIsMobile } from "@/layouts/responsive";

const CertificateListPage: FC = () => {
  const isMobile = useIsMobile();
  const { groupId: groupIdStr } = useParams();
  const groupId = Number(groupIdStr);
  const [groupList] = useAtom(stateGroupList);
  const [detailId, setDetailId] = useState<number | undefined>();

  const currentGroup = groupList.find((g) => g.id === groupId);
  const isUnlocked = currentGroup?.unlocked ?? false;

  const { data: certListResp, isLoading } = useCertificateList(
    groupId,
    isUnlocked,
  );

  if (!groupId || !currentGroup) {
    return (
      <Result
        status="warning"
        title="未知分组"
        subTitle="请检查链接是否正确，或者点击下方按钮返回默认分组"
        extra={
          <Link to="/">
            <Button>返回首页</Button>
          </Link>
        }
      />
    );
  }

  const renderContent = () => {
    if (!isUnlocked) {
      return <GroupUnlock group={currentGroup} />;
    }

    if (isLoading) {
      return (
        <div className="flex justify-center mt-[20vh]">
          <Spin size="large" />
        </div>
      );
    }

    const items = certListResp?.data?.items ?? [];

    if (items.length === 0) {
      return (
        <Empty
          className="mt-[20vh]"
          data-testid="certificate-list-empty"
          description={
            <span className="text-gray-500">
              暂无凭证，点击{isMobile ? "右下角" : "右上角"}按钮创建
            </span>
          }
        />
      );
    }

    return (
      <div>
        {items.map((item) => (
          <CertificateListItem
            key={item.id}
            detail={item}
            onClick={() => setDetailId(item.id)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {isUnlocked && !isMobile && (
        <div className="flex items-center justify-end p-3 border-b border-gray-200">
          <Button
            icon={<PlusOutlined />}
            type="primary"
            onClick={() => setDetailId(-1)}
          >
            新建凭证
          </Button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto">{renderContent()}</div>
      {isUnlocked && isMobile && (
        <div className="p-3 border-t border-gray-200 flex justify-end">
          <Button
            icon={<PlusOutlined />}
            type="primary"
            onClick={() => setDetailId(-1)}
          >
            新建凭证
          </Button>
        </div>
      )}
      <CertificateDetailModal
        groupId={groupId}
        detailId={detailId}
        onClose={() => setDetailId(undefined)}
      />
    </div>
  );
};

export default CertificateListPage;

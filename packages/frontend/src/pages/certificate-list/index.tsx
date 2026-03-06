import { FC, useEffect, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { stateGroupList, stateUser, GroupInfo } from "@/store/user";
import {
  useCertificateList,
  useDeleteCertificate,
} from "@/services/certificate";
import { usePageTitle } from "@/store/global";
import { GroupSidebar } from "./components/group-sidebar";
import { GroupUnlock } from "./components/group-unlock";
import { CertificateDetailModal } from "./components/certificate-detail";
import { CertificateListItem } from "./components/certificate-list-item";
import { Button, Empty, Spin, Drawer } from "antd";
import { PlusOutlined, DeleteOutlined, MenuOutlined } from "@ant-design/icons";
import { useIsMobile } from "@/layouts/responsive";

const SIDE_WIDTH = "220px";

const CertificateListPage: FC = () => {
  usePageTitle("凭证列表");
  const isMobile = useIsMobile();
  const [groupList] = useAtom(stateGroupList);
  const userInfo = useAtomValue(stateUser);
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>();
  const [detailId, setDetailId] = useState<number | undefined>();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const currentGroup = groupList.find((g) => g.id === selectedGroupId);
  const isUnlocked = currentGroup?.unlocked ?? false;

  const { data: certListResp, isLoading } = useCertificateList(
    selectedGroupId,
    isUnlocked,
  );
  const { mutateAsync: deleteCertificate } = useDeleteCertificate();

  // Auto-select default group on mount
  useEffect(() => {
    if (selectedGroupId !== undefined) return;
    if (userInfo?.defaultGroupId) {
      setSelectedGroupId(userInfo.defaultGroupId);
    } else if (groupList.length > 0) {
      setSelectedGroupId(groupList[0].id);
    }
  }, [groupList, userInfo]);

  const handleSelectGroup = (groupId: number) => {
    setSelectedGroupId(groupId);
    setMobileDrawerOpen(false);
  };

  const renderContent = () => {
    if (!currentGroup) {
      return <Empty className="mt-[20vh]" description="请选择一个分组" />;
    }

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
          description={
            <span className="text-gray-500">暂无凭证，点击上方按钮创建</span>
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

  const sidebar = (
    <GroupSidebar
      selectedGroupId={selectedGroupId}
      onSelectGroup={handleSelectGroup}
    />
  );

  // Mobile layout
  if (isMobile) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between p-3 border-b border-gray-200">
          <Button
            icon={<MenuOutlined />}
            type="text"
            onClick={() => setMobileDrawerOpen(true)}
          />
          <span className="font-medium truncate mx-2">
            {currentGroup?.name || "凭证列表"}
          </span>
          {isUnlocked && (
            <Button
              icon={<PlusOutlined />}
              type="primary"
              size="small"
              onClick={() => setDetailId(-1)}
            />
          )}
        </div>
        <div className="flex-1 overflow-y-auto">{renderContent()}</div>
        <Drawer
          placement="left"
          width={260}
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          styles={{ body: { padding: 0 } }}
        >
          {sidebar}
        </Drawer>
        <CertificateDetailModal
          groupId={selectedGroupId ?? 0}
          detailId={detailId}
          onClose={() => setDetailId(undefined)}
        />
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="h-full flex">
      <aside
        className="flex-shrink-0 border-r border-gray-200 overflow-hidden"
        style={{ width: SIDE_WIDTH }}
      >
        {sidebar}
      </aside>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-gray-200">
          <span className="font-medium text-lg">
            {currentGroup?.name || "凭证列表"}
          </span>
          {isUnlocked && (
            <Button
              icon={<PlusOutlined />}
              type="primary"
              onClick={() => setDetailId(-1)}
            >
              新建凭证
            </Button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">{renderContent()}</div>
      </div>
      <CertificateDetailModal
        groupId={selectedGroupId ?? 0}
        detailId={detailId}
        onClose={() => setDetailId(undefined)}
      />
    </div>
  );
};

export default CertificateListPage;

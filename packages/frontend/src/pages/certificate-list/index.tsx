import { FC, useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAtomValue } from "jotai";
import { stateUnlockedGroupIds } from "@/store/user";
import { useGroupList } from "@/services/group";
import {
  useCertificateList,
  useMoveCertificate,
  useUpdateCertificateSort,
  type CertificateListItemView,
} from "@/services/certificate";
import { GroupUnlock } from "./components/group-unlock";
import { CertificateDetailModal } from "./components/certificate-detail";
import { CertificateListItem } from "./components/certificate-list-item";
import { GroupConfigModal } from "./components/group-config-modal";
import { Draggable } from "@/components/draggable";
import { Button, Dropdown, Empty, Result, Space, Spin } from "antd";
import {
  PlusOutlined,
  SettingOutlined,
  RetweetOutlined,
  CloseOutlined,
  CheckSquareOutlined,
  SearchOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import {
  ActionButton,
  ActionIcon,
  CubePage,
  useIsMobile,
  MobileAccountSheet,
} from "@hopgoldy/cube-ui";
import { SidebarMobile } from "@/layouts/sidebar/mobile";
import { messageSuccess, messageWarning } from "@/utils/message";

const CertificateListPage: FC = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { groupId: groupIdStr } = useParams();
  const groupId = Number(groupIdStr);
  const { data: groupListResp, isLoading: isGroupListLoading } = useGroupList();
  const groupList = groupListResp?.data?.items ?? [];
  const unlockedGroupIds = useAtomValue(stateUnlockedGroupIds);
  const [detailId, setDetailId] = useState<number | undefined>();
  const [showGroupConfig, setShowGroupConfig] = useState(false);
  /** 移动凭证选择模式 */
  const [selectMode, setSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Record<number, boolean>>(
    {},
  );
  const { mutateAsync: runMoveCertificate } = useMoveCertificate();
  const { mutateAsync: updateCertificateSort } = useUpdateCertificateSort();
  const [dragging, setDragging] = useState(false);
  /** 移动端账号抽屉 */
  const [accountSheetVisible, setAccountSheetVisible] = useState(false);
  /** 移动端分组抽屉 */
  const [groupDrawerOpen, setGroupDrawerOpen] = useState(false);
  /** 本地可排序的凭证列表（displayName 由列表接口 nameEnc 解密而来） */
  const [certificateList, setCertificateList] = useState<
    CertificateListItemView[]
  >([]);

  const currentGroup = groupList.find((g) => g.id === groupId);
  const isUnlocked =
    !!currentGroup &&
    (currentGroup.lockType === "None" || unlockedGroupIds.has(currentGroup.id));

  const { data: certListResp, isLoading } = useCertificateList(
    groupId,
    isUnlocked,
  );

  useEffect(() => {
    if (!certListResp?.data?.items) return;
    setCertificateList(certListResp.data.items);
  }, [certListResp?.data?.items]);

  useEffect(() => {
    setGroupDrawerOpen(false);
  }, [groupId]);

  const items = certificateList;

  const closeSelectMode = () => {
    setSelectMode(false);
    setSelectedItems({});
  };

  const onMoveCertificate = async (newGroupId: number) => {
    const ids = Object.keys(selectedItems)
      .filter((key) => selectedItems[+key])
      .map(Number);

    if (ids.length === 0) {
      messageWarning("请选择至少一个凭证");
      return;
    }

    const resp = await runMoveCertificate({ ids, newGroupId });
    if (resp.code !== 200) return;

    messageSuccess("移动成功");
    closeSelectMode();
  };

  const getMoveTargets = () => {
    return groupList
      .filter((g) => g.id !== groupId)
      .map((g) => ({
        key: g.id,
        label: g.name,
        onClick: () => onMoveCertificate(g.id),
      }));
  };

  const onToggleSelectAll = () => {
    const newSelected: Record<number, boolean> = {};
    items.forEach((item) => {
      newSelected[item.id] = !selectedItems[item.id];
    });
    setSelectedItems(newSelected);
  };

  // 分组列表还在拉取时不能下结论，只有加载完仍找不到该组才算「未知分组」
  if (isGroupListLoading) {
    return (
      <div className="flex justify-center mt-[20vh]">
        <Spin size="large" />
      </div>
    );
  }

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

    const renderCertificateItem = (item: (typeof items)[0]) => (
      <CertificateListItem
        key={item.id}
        detail={item}
        dragging={dragging}
        selected={selectMode ? !!selectedItems[item.id] : undefined}
        onClick={() => {
          if (selectMode) {
            setSelectedItems((prev) => ({
              ...prev,
              [item.id]: !prev[item.id],
            }));
          } else {
            setDetailId(item.id);
          }
        }}
      />
    );

    return (
      <div className="mx-4 mt-4">
        <div className="flex flex-wrap justify-start">
          <Draggable
            className="w-full flex flex-wrap"
            value={items}
            sortableOptions={{
              disabled: isMobile,
              onStart: () => setDragging(true),
              onEnd: () => setDragging(false),
            }}
            renderItem={renderCertificateItem}
            onChange={(list) => {
              setCertificateList(list);
              updateCertificateSort(list.map((i) => i.id));
            }}
          />
        </div>
      </div>
    );
  };

  const renderMoveBtn = () => {
    if (groupList.length <= 1 || items.length <= 0) return null;

    if (!selectMode) {
      return (
        <Button
          key="move"
          icon={<RetweetOutlined />}
          onClick={() => setSelectMode(true)}
        >
          移动凭证
        </Button>
      );
    }

    return (
      <>
        <Dropdown menu={{ items: getMoveTargets() }}>
          <Button key="moveTo" type="primary" icon={<RetweetOutlined />}>
            移动至
          </Button>
        </Dropdown>
        <Button
          key="reverse"
          icon={<CheckSquareOutlined />}
          onClick={onToggleSelectAll}
        >
          反选
        </Button>
        <Button
          key="cancelMove"
          icon={<CloseOutlined />}
          onClick={closeSelectMode}
        >
          取消移动
        </Button>
      </>
    );
  };

  return (
    <>
      <CubePage
        mobileActionBar={
          <>
            <ActionIcon
              icon={<SettingOutlined />}
              aria-label="设置"
              onClick={() => setAccountSheetVisible(true)}
            />
            <ActionIcon
              icon={<UnorderedListOutlined />}
              aria-label="分组"
              onClick={() => setGroupDrawerOpen(true)}
            />
            <ActionIcon
              icon={<SearchOutlined />}
              aria-label="搜索"
              onClick={() => navigate("/search")}
            />
            <ActionButton
              icon={<PlusOutlined />}
              disabled={!isUnlocked}
              onClick={() => setDetailId(-1)}
              data-testid="add-certificate-btn"
            >
              新建密码
            </ActionButton>
          </>
        }
      >
        <div className="h-full flex flex-col overflow-hidden">
          {isUnlocked && !isMobile && (
            <div className="flex items-center justify-end p-3 border-b border-gray-200 dark:border-gray-700">
              <Space>
                <Button
                  icon={<SettingOutlined />}
                  onClick={() => setShowGroupConfig(true)}
                >
                  分组配置
                </Button>
                {renderMoveBtn()}
                {!selectMode && (
                  <Button
                    icon={<PlusOutlined />}
                    type="primary"
                    onClick={() => setDetailId(-1)}
                    data-testid="add-certificate-btn"
                  >
                    新建密码
                  </Button>
                )}
              </Space>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">{renderContent()}</div>
        </div>
      </CubePage>
      <SidebarMobile
        open={groupDrawerOpen}
        onClose={() => setGroupDrawerOpen(false)}
      />
      <MobileAccountSheet
        visible={accountSheetVisible}
        onVisibleChange={setAccountSheetVisible}
      />
      <CertificateDetailModal
        groupId={groupId}
        detailId={detailId}
        onClose={() => setDetailId(undefined)}
      />
      {currentGroup && (
        <GroupConfigModal
          open={showGroupConfig}
          group={currentGroup}
          onClose={() => setShowGroupConfig(false)}
        />
      )}
    </>
  );
};

export default CertificateListPage;

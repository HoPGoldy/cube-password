import { FC, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PlusOutlined, LockOutlined } from "@ant-design/icons";
import { Button, ConfigProvider, Drawer, Space } from "antd";
import { useAtomValue } from "jotai";
import { stateUnlockedGroupIds } from "@/store/user";
import { useAddGroup, useGroupList } from "@/services/group";
import type {
  SchemaGroupItemType,
  SchemaGroupAddBodyType,
} from "@shared-types/group";
import { messageSuccess } from "@/utils/message";
import { AddGroupModal } from "@/components/add-group-modal";

interface SidebarMobileProps {
  open: boolean;
  onClose: () => void;
}

export const SidebarMobile: FC<SidebarMobileProps> = ({ open, onClose }) => {
  const { groupId } = useParams();
  const { data: groupListResp } = useGroupList();
  const unlockedGroupIds = useAtomValue(stateUnlockedGroupIds);
  const { mutateAsync: addGroup, isPending: addingGroup } = useAddGroup();
  const [addModalOpen, setAddModalOpen] = useState(false);

  const groups = groupListResp?.data?.items ?? [];

  const onAddGroup = async (data: SchemaGroupAddBodyType) => {
    const resp = await addGroup(data);
    if (resp?.code !== 200) return;
    messageSuccess("分组已创建");
    setAddModalOpen(false);
  };

  const isUnlocked = (item: SchemaGroupItemType) =>
    item.lockType === "None" || unlockedGroupIds.has(item.id);

  const renderGroupItem = (item: SchemaGroupItemType) => {
    const isActive = groupId && +groupId === item.id;

    return (
      <Link key={item.id} to={`/group/${item.id}`}>
        <Button
          block
          type={isActive ? "primary" : "default"}
          size="large"
          icon={isUnlocked(item) ? undefined : <LockOutlined />}
          onClick={onClose}
        >
          {item.name}
        </Button>
      </Link>
    );
  };

  return (
    <>
      <ConfigProvider
        theme={{
          token: {
            fontSize: 16,
            lineHeight: 1.6,
          },
        }}
      >
        <Drawer
          title="分组选择"
          placement="bottom"
          height="22rem"
          open={open}
          onClose={onClose}
          closable={false}
          styles={{
            body: { padding: 8, paddingBottom: 0 },
            footer: { padding: 8, border: "none" },
            header: { textAlign: "center", padding: 8 },
          }}
          footer={
            <Button
              icon={<PlusOutlined />}
              size="large"
              block
              onClick={() => setAddModalOpen(true)}
            >
              新建分组
            </Button>
          }
        >
          <div className="flex-grow flex-shrink overflow-y-auto noscrollbar overflow-x-hidden my-3">
            <Space direction="vertical" style={{ width: "100%" }}>
              {groups.map(renderGroupItem)}
            </Space>
          </div>
        </Drawer>
      </ConfigProvider>
      <AddGroupModal
        open={addModalOpen}
        loading={addingGroup}
        onOk={onAddGroup}
        onCancel={() => setAddModalOpen(false)}
      />
    </>
  );
};

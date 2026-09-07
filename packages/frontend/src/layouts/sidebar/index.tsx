import { FC, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { RightOutlined, PlusOutlined, LockOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { useAtomValue } from "jotai";
import { stateUnlockedGroupIds } from "@/store/user";
import { useAddGroup, useGroupList } from "@/services/group";
import type {
  SchemaGroupItemType,
  SchemaGroupAddBodyType,
} from "@shared-types/group";
import { messageSuccess } from "@/utils/message";
import { APP_NAME } from "@/config";
import { AddGroupModal } from "@/components/add-group-modal";
import s from "./styles.module.css";

export const Sidebar: FC = () => {
  const { data: groupListResp } = useGroupList();
  const unlockedGroupIds = useAtomValue(stateUnlockedGroupIds);
  const { groupId } = useParams();
  const { mutateAsync: addGroup, isPending: addingGroup } = useAddGroup();
  const [addModalOpen, setAddModalOpen] = useState(false);

  const groups = groupListResp?.data?.items ?? [];

  const onAddGroup = async (data: SchemaGroupAddBodyType) => {
    const resp = await addGroup(data);
    if (resp?.code !== 200) return;
    messageSuccess("分组已创建");
    setAddModalOpen(false);
  };

  const renderGroupItem = (item: SchemaGroupItemType) => {
    const className = [s.menuItem];
    if (groupId && +groupId === item.id) className.push(s.menuItemActive);

    return (
      <div key={item.id}>
        <Link to={`/group/${item.id}`}>
          <div
            className={className.join(" ")}
            title={item.name}
            data-testid={`sidebar-group-${item.id}`}
          >
            <span className="truncate">{item.name}</span>
            {item.lockType === "None" || unlockedGroupIds.has(item.id) ? (
              <RightOutlined />
            ) : (
              <LockOutlined />
            )}
          </div>
        </Link>
      </div>
    );
  };

  return (
    <section className={s.sidebarBox} data-testid="sidebar">
      <div className="flex flex-row flex-nowrap items-center justify-center">
        <div className="font-black text-lg">{APP_NAME}</div>
      </div>

      <div className="flex-grow flex-shrink overflow-y-auto noscrollbar overflow-x-hidden my-3">
        {groups.map(renderGroupItem)}
      </div>

      <Button
        className={`${s.toolBtn} keep-antd-style`}
        icon={<PlusOutlined />}
        block
        data-testid="sidebar-add-group-btn"
        onClick={() => setAddModalOpen(true)}
      >
        新建分组
      </Button>

      <AddGroupModal
        open={addModalOpen}
        loading={addingGroup}
        onOk={onAddGroup}
        onCancel={() => setAddModalOpen(false)}
      />
    </section>
  );
};

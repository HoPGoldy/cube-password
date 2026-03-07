import { FC, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { RightOutlined, PlusOutlined, LockOutlined } from "@ant-design/icons";
import { Button, Input, Modal, Space } from "antd";
import { useAtom } from "jotai";
import { stateGroupList, GroupInfo } from "@/store/user";
import { useAddGroup, useUpdateGroupSort } from "@/services/group";
import { messageSuccess } from "@/utils/message";
import s from "./styles.module.css";

export const Sidebar: FC = () => {
  const [groups, setGroups] = useAtom(stateGroupList);
  const { groupId } = useParams();
  const { mutateAsync: addGroup } = useAddGroup();
  const { mutateAsync: updateGroupSort } = useUpdateGroupSort();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const onAddGroup = async () => {
    if (!newGroupName.trim()) return;
    const resp = await addGroup({ name: newGroupName.trim() });
    if (resp?.code !== 200) return;
    messageSuccess("分组已创建");
    setAddModalOpen(false);
    setNewGroupName("");
  };

  const renderGroupItem = (item: GroupInfo) => {
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
            {item.unlocked ? <RightOutlined /> : <LockOutlined />}
          </div>
        </Link>
      </div>
    );
  };

  return (
    <section className={s.sidebarBox} data-testid="sidebar">
      <div className="flex flex-row flex-nowrap items-center justify-center">
        <div className="font-black text-lg">密码本</div>
      </div>

      <div className="flex-grow flex-shrink overflow-y-auto noscrollbar overflow-x-hidden my-3">
        <Space direction="vertical" style={{ width: "100%" }}>
          {groups.map(renderGroupItem)}
        </Space>
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

      <Modal
        title="新建分组"
        open={addModalOpen}
        onOk={onAddGroup}
        onCancel={() => {
          setAddModalOpen(false);
          setNewGroupName("");
        }}
      >
        <Input
          placeholder="分组名称"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          onKeyUp={(e) => e.key === "Enter" && onAddGroup()}
          autoFocus
        />
      </Modal>
    </section>
  );
};

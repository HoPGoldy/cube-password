import { FC, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { stateGroupList, stateUser, GroupInfo } from "@/store/user";
import {
  LockOutlined,
  UnlockOutlined,
  PlusOutlined,
  LogoutOutlined,
  SettingOutlined,
  SearchOutlined,
  BellOutlined,
} from "@ant-design/icons";
import { Button, Input, Modal, Space } from "antd";
import { useAddGroup } from "@/services/group";
import { messageSuccess } from "@/utils/message";
import { Link, useNavigate } from "react-router-dom";
import { useLogout } from "@/services/auth";
import { logout } from "@/store/user";
import s from "./styles.module.css";

interface Props {
  selectedGroupId: number | undefined;
  onSelectGroup: (groupId: number) => void;
}

export const GroupSidebar: FC<Props> = ({ selectedGroupId, onSelectGroup }) => {
  const [groupList, setGroupList] = useAtom(stateGroupList);
  const userInfo = useAtomValue(stateUser);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const { mutateAsync: addGroup } = useAddGroup();
  const { mutateAsync: postLogout } = useLogout();
  const navigate = useNavigate();

  const onAddGroup = async () => {
    if (!newGroupName.trim()) return;
    const resp = await addGroup({ name: newGroupName.trim() });
    if (resp?.code !== 200) return;
    messageSuccess("分组已创建");
    setAddModalOpen(false);
    setNewGroupName("");
    // Refresh group list from login response format
    if (resp.data?.newList) {
      setGroupList(
        resp.data.newList.map((g) => ({
          id: g.id,
          name: g.name,
          lockType: (g as any).lockType || "None",
          unlocked: (g as any).lockType === "None",
        })),
      );
      onSelectGroup(resp.data.newId);
    }
  };

  const onLogout = async () => {
    await postLogout();
    logout();
    navigate("/login", { replace: true });
  };

  const renderGroupItem = (group: GroupInfo) => {
    const isActive = group.id === selectedGroupId;
    const LockIcon = group.unlocked ? UnlockOutlined : LockOutlined;

    return (
      <div
        key={group.id}
        className={`${s.menuItem} ${isActive ? s.menuItemActive : ""}`}
        onClick={() => onSelectGroup(group.id)}
      >
        <LockIcon className="mr-2 text-sm flex-shrink-0" />
        <span className="truncate flex-1">{group.name}</span>
      </div>
    );
  };

  return (
    <section className={s.sidebarBox}>
      <div className="p-3 text-lg font-bold text-center">Cube Password</div>

      <div className="px-3 mb-2">
        <Button
          icon={<PlusOutlined />}
          block
          size="small"
          onClick={() => setAddModalOpen(true)}
        >
          新建分组
        </Button>
      </div>

      <div className="flex-grow overflow-y-auto noscrollbar px-1">
        <Space direction="vertical" style={{ width: "100%" }} size={2}>
          {groupList.map(renderGroupItem)}
        </Space>
      </div>

      <div className="flex-shrink-0 p-2 border-t border-gray-200 space-y-1">
        <Link to="/search">
          <Button
            icon={<SearchOutlined />}
            block
            type="text"
            className="text-left"
          >
            搜索
          </Button>
        </Link>
        <Link to="/security-log">
          <Button
            icon={<BellOutlined />}
            block
            type="text"
            className="text-left"
          >
            安全日志
            {userInfo?.hasNotice && (
              <span className="ml-1 w-2 h-2 bg-red-500 rounded-full inline-block" />
            )}
          </Button>
        </Link>
        <Link to="/settings">
          <Button
            icon={<SettingOutlined />}
            block
            type="text"
            className="text-left"
          >
            设置
          </Button>
        </Link>
        <Button
          icon={<LogoutOutlined />}
          block
          type="text"
          className="text-left"
          danger
          onClick={onLogout}
        >
          退出登录
        </Button>
      </div>

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

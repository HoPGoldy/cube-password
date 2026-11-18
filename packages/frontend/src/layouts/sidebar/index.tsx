import { FC, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { RightOutlined, PlusOutlined, LockOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { useAtomValue } from "jotai";
import { stateUnlockedGroupIds } from "@/store/user";
import {
  useAddGroup,
  useGroupList,
  useUpdateGroupSort,
} from "@/services/group";
import type {
  SchemaGroupItemType,
  SchemaGroupAddBodyType,
} from "@shared-types/group";
import { messageSuccess } from "@/utils/message";
import { APP_NAME } from "@/config";
import { AddGroupModal } from "@/components/add-group-modal";
import { Draggable } from "@/components/draggable";
import s from "./styles.module.css";

export const Sidebar: FC = () => {
  const { data: groupListResp, refetch: refetchGroupList } = useGroupList();
  const unlockedGroupIds = useAtomValue(stateUnlockedGroupIds);
  const { groupId } = useParams();
  const { mutateAsync: addGroup, isPending: addingGroup } = useAddGroup();
  const { mutateAsync: updateGroupSort, isPending: sortingGroup } =
    useUpdateGroupSort();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [sortedGroups, setSortedGroups] = useState<SchemaGroupItemType[]>([]);

  const groups = groupListResp?.data?.items ?? [];

  useEffect(() => {
    setSortedGroups(groups);
  }, [groupListResp?.data?.items]);

  const onAddGroup = async (data: SchemaGroupAddBodyType) => {
    const resp = await addGroup(data);
    if (resp?.code !== 200) return;
    messageSuccess("分组已创建");
    setAddModalOpen(false);
  };

  const onSortGroups = async (nextGroups: SchemaGroupItemType[]) => {
    setSortedGroups(nextGroups);

    const restoreLatestGroups = async () => {
      // 不用拖拽前的整份快照回滚，避免覆盖请求期间新增或删除的分组
      const result = await refetchGroupList();
      const latestGroups = result.data?.data?.items;
      if (latestGroups) setSortedGroups(latestGroups);
    };

    try {
      const resp = await updateGroupSort(nextGroups.map((item) => item.id));
      if (resp.code !== 200) await restoreLatestGroups();
    } catch {
      // 请求异常已由全局拦截器提示；重新读取服务端状态完成回滚
      await restoreLatestGroups();
    }
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
        <Draggable
          value={sortedGroups}
          sortableOptions={{ disabled: sortingGroup }}
          renderItem={renderGroupItem}
          onChange={(nextGroups) => {
            void onSortGroups(nextGroups);
          }}
        />
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

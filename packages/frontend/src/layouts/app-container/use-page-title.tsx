import { FC, useEffect, useState } from "react";
import { Input } from "antd";
import { useLocation, useParams } from "react-router-dom";
import { useAtom, useAtomValue } from "jotai";
import { stateGroupList, GroupInfo } from "@/store/user";
import { useUpdateGroupName } from "@/services/group";

const pageTitle: Record<string, string> = {
  "/search": "搜索凭证",
};

export const useHeaderPageTitle = () => {
  const { pathname } = useLocation();
  const params = useParams();
  const groupId = Number(params.groupId);
  const [groupList, setGroupList] = useAtom(stateGroupList);
  const group = groupList.find((g) => g.id === groupId);
  const [groupTitle, setGroupTitle] = useState<string>();
  const { mutateAsync: runSaveName, isPending: isSaving } =
    useUpdateGroupName();

  useEffect(() => {
    if (!groupId || !group) return;
    setGroupTitle(group?.name);
  }, [group]);

  const getTitle = () => {
    if (pathname in pageTitle) return pageTitle[pathname];
    return "";
  };

  const onSaveTitle = async () => {
    if (!groupId || !group) return;
    if (groupTitle === group.name) return;
    if (!groupTitle) {
      setGroupTitle(group.name);
      return;
    }

    const resp = await runSaveName({ id: groupId, name: groupTitle });
    if (resp.code !== 200) return;

    setGroupList((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, name: groupTitle } : { ...g },
      ),
    );
  };

  const renderTitle = () => {
    if (groupId) {
      return (
        <Input
          className="text-lg pl-0"
          variant="borderless"
          value={groupTitle}
          onChange={(e) => setGroupTitle(e.target.value)}
          onBlur={onSaveTitle}
          onKeyUp={(e) => {
            if (e.key === "Enter") (e.target as HTMLElement).blur();
          }}
          disabled={isSaving || !group?.unlocked}
        />
      );
    }

    return <div className="text-lg cursor-default">{getTitle()}</div>;
  };

  return renderTitle;
};

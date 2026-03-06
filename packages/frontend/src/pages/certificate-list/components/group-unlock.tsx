import { FC, useState } from "react";
import { Button, Input } from "antd";
import { LockOutlined, KeyOutlined } from "@ant-design/icons";
import { useUnlockGroup } from "@/services/group";
import { sha512 } from "@/utils/crypto";
import { queryChallenge } from "@/services/auth";
import { messageError, messageSuccess } from "@/utils/message";
import { GroupInfo, stateGroupList } from "@/store/user";
import { useSetAtom } from "jotai";

interface Props {
  group: GroupInfo;
}

export const GroupUnlock: FC<Props> = ({ group }) => {
  const [code, setCode] = useState("");
  const { mutateAsync: unlock, isPending } = useUnlockGroup();
  const setGroupList = useSetAtom(stateGroupList);

  const onUnlock = async () => {
    if (!code) {
      messageError("请输入解锁密码或验证码");
      return;
    }

    const unlockData: {
      id: number;
      hash?: string;
      challengeCode?: string;
      totpCode?: string;
    } = { id: group.id };

    if (group.lockType === "Password") {
      const challengeResp = await queryChallenge();
      if (!challengeResp.success) return;
      const challengeCode = challengeResp.data!.code;
      unlockData.hash = sha512(code + challengeCode);
      unlockData.challengeCode = challengeCode;
    } else if (group.lockType === "Totp") {
      unlockData.totpCode = code;
    }

    const resp = await unlock(unlockData);
    if (resp?.code !== 200) return;

    messageSuccess("分组已解锁");
    setGroupList((prev) =>
      prev.map((g) => (g.id === group.id ? { ...g, unlocked: true } : g)),
    );
    setCode("");
  };

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <LockOutlined className="text-6xl text-gray-300 mb-4" />
      <div className="text-lg text-gray-500 mb-4">分组已锁定</div>
      <div className="w-64">
        <Input.Password
          size="large"
          placeholder={
            group.lockType === "Totp" ? "请输入动态验证码" : "请输入分组密码"
          }
          prefix={<KeyOutlined />}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyUp={(e) => e.key === "Enter" && onUnlock()}
          autoFocus
        />
        <Button
          type="primary"
          block
          size="large"
          className="mt-2"
          loading={isPending}
          onClick={onUnlock}
        >
          解锁
        </Button>
      </div>
    </div>
  );
};

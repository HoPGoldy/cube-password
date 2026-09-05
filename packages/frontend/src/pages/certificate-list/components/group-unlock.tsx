import { FC, useState } from "react";
import { Button, Input } from "antd";
import { LockOutlined, KeyOutlined } from "@ant-design/icons";
import { useUnlockGroup } from "@/services/group";
import { sha512 } from "@/utils/crypto";
import { queryChallenge } from "@/services/auth";
import { messageError, messageSuccess } from "@/utils/message";
import { GroupInfo, stateGroupList } from "@/store/user";
import { useSetAtom } from "jotai";
import {
  deriveMasterKey,
  parseKdfParams,
  ErrorInvalidKdfParams,
} from "@/lib/e2ee";
import { bytesToHex, hexToBytes } from "@/lib/e2ee/format";

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
      totpCode?: string;
    } = { id: group.id };

    if (group.lockType === "Password") {
      // 旧格式判定：kdfParams 空/缺省即 v1 遗留（sha512(salt+pwd)），
      // 无法用新链路解锁，显式提示重新设置（存量升级走迁移脚本）
      if (!group.salt || !group.kdfParams) {
        messageError("旧版锁密码，请重新设置分组锁密码");
        return;
      }
      // 解析并校验 kdfParams（JSON 非法 / 算法或版本不识别时显式报错，
      // 禁止静默回落默认值，否则会派生出与库内 V 不一致的密钥）
      let params;
      try {
        params = parseKdfParams(group.kdfParams);
      } catch (err) {
        const detail =
          err instanceof ErrorInvalidKdfParams
            ? err.message
            : `未知错误：${err instanceof Error ? err.message : String(err)}`;
        messageError(`分组锁密码参数非法，请重新设置分组锁密码：${detail}`);
        return;
      }

      // v2：argon2id(password, salt, kdfParams) → 64B，前 32B KEK（丢弃）
      // + 后 32B V，约 0.5s；unlock hash = SHA512(hex(V) + challenge)
      const challengeResp = await queryChallenge();
      if (!challengeResp.success) return;
      const challengeCode = challengeResp.data!.code;
      let verifier: Uint8Array;
      try {
        ({ verifier } = await deriveMasterKey(
          code,
          hexToBytes(group.salt),
          params,
        ));
      } catch (err) {
        messageError(
          `密钥派生失败：${err instanceof Error ? err.message : String(err)}`,
        );
        return;
      }
      unlockData.hash = sha512(bytesToHex(verifier) + challengeCode);
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

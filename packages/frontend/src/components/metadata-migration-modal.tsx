import { FC, useEffect, useState } from "react";
import { Button, Modal, Progress } from "antd";
import { useAtomValue } from "jotai";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { stateUser, stateUnlockedGroupIds } from "@/store/user";
import { useGroupList } from "@/services/group";
import {
  finishMigration,
  fetchPendingMigrateIds,
  hasLockedGroupsMigrationBlocker,
  runMetadataMigration,
} from "@/services/metadata-migration";
import { messageError, messageSuccess } from "@/utils/message";

interface MetadataMigrationModalProps {
  /** 迁移全部完成（或被阻断确认）后的回调（如跳转首页） */
  onFinish: () => void;
}

/**
 * 存量元数据迁移提示（metadataVersion === 1 时登录后弹出）
 *
 * 交互模式：说明 + 「开始迁移」按钮（与既有存量升级提示同构，简单清晰）。
 * - 空库（无待迁移条目）时自动静默收尾 finish，不弹窗
 * - 存在「有凭证但未解锁」分组时提示先解锁（后端写门禁 403，锁定组名称不可读）
 * - 中断可重试：以 nameEnc 空串条目判断剩余进度，天然幂等
 */
export const MetadataMigrationModal: FC<MetadataMigrationModalProps> = ({
  onFinish,
}) => {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);

  const userInfo = useAtomValue(stateUser);
  const unlockedGroupIds = useAtomValue(stateUnlockedGroupIds);
  const queryClient = useQueryClient();
  const { data: groupListResp } = useGroupList();

  const metadataVersion = userInfo?.metadataVersion ?? 2;

  // 登录后探测迁移进度：仅 metadataVersion===1 时探测。
  // queryKey 绑定解锁集快照：解锁集变化（用户解锁分组）时 react-query 自动重探，
  // pendingResp 永远对应「当前解锁态」的探测结果，杜绝过期数据决策
  const unlockedKey = Array.from(unlockedGroupIds)
    .sort((a, b) => a - b)
    .join(",");
  const { data: pendingResp, isLoading } = useQuery({
    queryKey: ["metadataMigrationPending", metadataVersion, unlockedKey],
    queryFn: fetchPendingMigrateIds,
    enabled: metadataVersion === 1,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (metadataVersion !== 1 || !pendingResp || !groupListResp) return;

    const { pendingIds, total } = pendingResp;

    // 锁定分组门禁检查先行（以当前 session 解锁态为准）：
    // 存在「有凭证且未解锁」的分组时弹窗提示，绝不能先于它做静默收尾——
    // 否则全锁定库会被错误 finish，锁定组凭证永久失去迁移机会。
    // 注意：certificate/index 只含本 session 可达分组，pendingIds 为空不等于
    // 全部凭证已迁移，必须结合锁定分组状态判断。
    if (
      pendingIds.length === 0 &&
      !hasLockedGroupsMigrationBlocker(
        groupListResp.data?.items ?? [],
        unlockedGroupIds,
      )
    ) {
      // 空库（或全部已迁移且无锁定组阻碍）：本地置 metadataVersion=2 避免本会话
      // 重复弹窗（不写服务端——空库时服务端 finish 走 migrate-metadata 空批，
      // 留给真实迁移流程；下次登录会重新探测，开销一次 index 调用，可接受）
      finishMigration(queryClient)
        .catch(() => {
          // 收尾失败不阻塞进入应用（下次登录重试）
        })
        .finally(onFinish);
      return;
    }

    // 每次评估都重算 blocked（可复位）：解锁全部带锁分组后，重开的弹窗
    // 自动回到「可迁移」呈现，开始迁移按钮可达
    const blocker = hasLockedGroupsMigrationBlocker(
      groupListResp.data?.items ?? [],
      unlockedGroupIds,
    );

    if (pendingIds.length === 0) {
      // 有锁定分组阻碍但可达部分已迁移完：弹窗提示解锁（不能静默收尾）
      setBlocked(true);
      setProgress({ done: total, total });
      setOpen(true);
      return;
    }

    setBlocked(blocker);
    setProgress({ done: total - pendingIds.length, total });
    setOpen(true);
  }, [pendingResp, groupListResp, unlockedGroupIds]);

  const onStart = async () => {
    setRunning(true);
    setFailed(false);
    try {
      const pending = await fetchPendingMigrateIds();
      await runMetadataMigration(pending.pendingIds, (done, total) =>
        setProgress({ done, total }),
      );
      // metadataVersion=2 已随最后一批落库；探测缓存作废，本地 metadataVersion 由
      // finishMigration 更新
      queryClient.removeQueries({ queryKey: ["metadataMigrationPending"] });
      messageSuccess("迁移完成");
      setOpen(false);
      onFinish();
    } catch {
      messageError(
        "迁移失败，已迁移的条目不会重复；可关闭后稍后重试或重新登录继续",
      );
      // 失败态：展示重试/稍后按钮，避免把用户锁死在弹窗内；
      // 作废探测缓存，重开时以最新进度呈现
      setFailed(true);
      queryClient.removeQueries({ queryKey: ["metadataMigrationPending"] });
    } finally {
      setRunning(false);
    }
  };

  // blocked 状态下关闭弹窗（不 navigate，留在当前页去解锁；解锁后
  // unlockedGroupIds 变化 → queryKey 变化 → 自动重探 → effect 以新数据重开弹窗，
  // 此时 blocker 已为 false，弹窗回到「可迁移」呈现）
  const onCloseBlocked = () => {
    setOpen(false);
  };

  // metadataVersion !== 1 时整个组件不渲染
  if (metadataVersion !== 1) return null;

  return (
    <Modal
      open={open && !isLoading}
      title="凭证名称加密迁移"
      closable={false}
      maskClosable={false}
      keyboard={false}
      footer={
        blocked
          ? [
              <Button key="ok" type="primary" onClick={onCloseBlocked}>
                我知道了，去解锁
              </Button>,
            ]
          : [
              <Button
                key="start"
                type="primary"
                loading={running}
                onClick={onStart}
                data-testid="migrate-start-btn"
              >
                {failed ? "重试迁移" : "开始迁移"}
              </Button>,
              ...(failed
                ? [
                    <Button key="later" onClick={() => setOpen(false)}>
                      稍后再说
                    </Button>,
                  ]
                : []),
            ]
      }
    >
      {blocked ? (
        <div
          className="text-gray-600 dark:text-gray-300"
          data-testid="migrate-blocked"
        >
          存在带锁分组中的凭证尚未加密迁移，需先解锁这些分组才能完成迁移。请关闭本窗口，
          在左侧分组列表中解锁全部带锁分组后，返回本提示继续（或重新登录后继续）。
        </div>
      ) : (
        <>
          <div className="text-gray-600 dark:text-gray-300 mb-4">
            为提升安全性，凭证名称将全部转为端到端加密存储，服务端将无法再查看凭证名称。
            迁移过程中请保持页面开启，中断后可重新登录继续，不会丢失数据。
          </div>
          {running ? (
            <div className="flex items-center gap-3">
              <Progress
                className="flex-1"
                percent={
                  progress.total > 0
                    ? Math.round((progress.done / progress.total) * 100)
                    : 0
                }
                size="small"
              />
              <span className="text-sm text-gray-500">
                {progress.done}/{progress.total}
              </span>
            </div>
          ) : (
            <div
              className="text-sm text-gray-500"
              data-testid="migrate-pending-count"
            >
              待迁移凭证：{progress.total - progress.done} 条
            </div>
          )}
        </>
      )}
    </Modal>
  );
};

export default MetadataMigrationModal;

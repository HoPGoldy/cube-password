import { FC, useEffect, useState } from "react";
import { Button, Col, Input, Modal, Result, Row } from "antd";
import { WarningOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { useDeleteGroup } from "@/services/group";
import { stateUnlockedGroupIds, stateUser } from "@/store/user";
import { messageSuccess, messageWarning } from "@/utils/message";
import type { SchemaGroupItemType } from "@shared-types/group";

interface Props {
  open: boolean;
  /** 待删除分组（由调用方保证存在） */
  group: SchemaGroupItemType;
  /** 关闭确认弹窗（取消或删除完成后调用） */
  onClose: () => void;
  /** 删除成功后的额外清理（例如关闭分组配置弹窗） */
  onDeleted?: () => void;
}

/**
 * 分组删除确认弹窗。删除分组是数据不可恢复的破坏性操作，因此统一要求
 * 逐字输入分组名确认（名称不加密，锁定分组同样可核对）。
 *
 * 分组锁只保护「读」，不保护「删」：锁定分组不需要分组密码即可删除，
 * 否则忘记分组密码时数据将永远无法清理。
 */
export const GroupDeleteConfirm: FC<Props> = ({
  open,
  group,
  onClose,
  onDeleted,
}) => {
  const navigate = useNavigate();
  const [confirmInput, setConfirmInput] = useState("");
  const setUserInfo = useSetAtom(stateUser);
  const setUnlockedGroupIds = useSetAtom(stateUnlockedGroupIds);
  const { mutateAsync: runDeleteGroup, isPending: deleting } = useDeleteGroup();

  useEffect(() => {
    if (!open) setConfirmInput("");
  }, [open]);

  const onCancel = () => {
    setConfirmInput("");
    onClose();
  };

  const onDelete = async () => {
    if (confirmInput !== group.name) {
      messageWarning("分组名称不正确");
      setConfirmInput("");
      return;
    }

    const resp = await runDeleteGroup({ id: group.id });
    if (resp.code !== 200) {
      setConfirmInput("");
      return;
    }

    // 删除后的默认分组：删除默认分组时后端已切到剩余第一个分组
    const defaultGroupId = resp.data?.defaultGroupId ?? 0;
    setUnlockedGroupIds((prev: Set<number>) => {
      const next = new Set(prev);
      next.delete(group.id);
      return next;
    });
    setUserInfo((prev) => (prev ? { ...prev, defaultGroupId } : prev));

    onCancel();
    onDeleted?.();
    messageSuccess("分组删除成功");

    // 当前页就是被删分组，跳到删除后的默认分组（replace，避免后退回到已删分组）
    navigate(defaultGroupId ? `/group/${defaultGroupId}` : "/", {
      replace: true,
    });
  };

  return (
    <Modal
      open={open}
      closable={false}
      width={400}
      onCancel={onCancel}
      footer={false}
    >
      <Result
        className="p-0"
        icon={<WarningOutlined className="!text-yellow-400" />}
        title="分组删除确认"
        subTitle={
          <div className="text-black">
            分组删除后，其中的凭证将被 <b>一并删除</b> 且无法恢复。
            {group.lockType !== "None" &&
              "该分组当前已锁定，删除不需要输入分组密码。"}
            如果确定要删除，请在下方输入"{group.name}"
          </div>
        }
        extra={
          <Row gutter={[8, 8]}>
            <Col span={24}>
              <Input
                placeholder="请输入分组名称"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                onKeyUp={(e) => {
                  if (e.key === "Enter") onDelete();
                }}
                data-testid="group-delete-confirm-input"
              />
            </Col>
            <Col span={12}>
              <Button block onClick={onCancel}>
                返回
              </Button>
            </Col>
            <Col span={12}>
              <Button
                type="primary"
                danger
                block
                onClick={onDelete}
                loading={deleting}
                data-testid="group-delete-confirm-btn"
              >
                删除
              </Button>
            </Col>
          </Row>
        }
      />
    </Modal>
  );
};

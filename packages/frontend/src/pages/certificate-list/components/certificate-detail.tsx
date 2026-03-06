import { FC, useEffect, useRef, useState } from "react";
import { Button, Form, Input, Modal, Space, Tag } from "antd";
import { PlusOutlined, CopyOutlined, DeleteOutlined } from "@ant-design/icons";
import {
  useCertificateDetail,
  useAddCertificate,
  useUpdateCertificate,
} from "@/services/certificate";
import { aes, aesDecrypt } from "@/utils/crypto";
import { useAtomValue } from "jotai";
import { stateMainPwd } from "@/store/user";
import { messageError, messageSuccess, messageWarning } from "@/utils/message";
import copy from "copy-to-clipboard";

interface CertificateField {
  label: string;
  value: string;
}

interface Props {
  groupId: number;
  detailId: number | undefined;
  onClose: () => void;
}

export const CertificateDetailModal: FC<Props> = ({
  groupId,
  detailId,
  onClose,
}) => {
  const isAdd = detailId === -1;
  const { pwdKey, pwdIv } = useAtomValue(stateMainPwd);
  const [title, setTitle] = useState("");
  const [fields, setFields] = useState<CertificateField[]>([]);
  const [readonly, setReadonly] = useState(true);
  const { data: detailResp } = useCertificateDetail(
    isAdd ? undefined : detailId,
  );
  const { mutateAsync: addCertificate, isPending: isAdding } =
    useAddCertificate();
  const { mutateAsync: updateCertificate, isPending: isUpdating } =
    useUpdateCertificate();

  useEffect(() => {
    if (!detailId) return;
    if (isAdd) {
      setTitle("新密码");
      setFields([
        { label: "网址", value: "" },
        { label: "用户名", value: "" },
        { label: "密码", value: "" },
      ]);
      setReadonly(false);
    } else {
      setReadonly(true);
    }
  }, [detailId]);

  useEffect(() => {
    if (!detailResp?.data || !pwdKey || !pwdIv) return;

    const { content, name } = detailResp.data;
    try {
      const parsed = JSON.parse(aesDecrypt(content, pwdKey, pwdIv));
      setTitle(name);
      setFields(parsed);
    } catch {
      messageError("凭证解密失败");
      onClose();
    }
  }, [detailResp]);

  const onSave = async () => {
    if (!title.trim()) {
      messageWarning("标题不能为空");
      return;
    }
    if (!pwdKey || !pwdIv) {
      messageWarning("主密码错误，请尝试重新登录");
      return;
    }

    const content = aes(JSON.stringify(fields), pwdKey, pwdIv);

    if (isAdd) {
      await addCertificate({ name: title, groupId, content });
    } else {
      await updateCertificate({
        id: detailId!,
        name: title,
        groupId,
        content,
      });
    }

    messageSuccess("保存成功");
    onClose();
  };

  const onCopyField = (field: CertificateField) => {
    copy(field.value);
    messageSuccess(`已复制: ${field.label}`);
  };

  const addField = () => {
    setFields([...fields, { label: `字段${fields.length + 1}`, value: "" }]);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, key: "label" | "value", val: string) => {
    setFields(fields.map((f, i) => (i === index ? { ...f, [key]: val } : f)));
  };

  return (
    <Modal
      title={readonly ? title : "编辑凭证"}
      open={!!detailId}
      onCancel={onClose}
      width={600}
      footer={
        readonly ? (
          <Button type="primary" onClick={() => setReadonly(false)}>
            编辑
          </Button>
        ) : (
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button
              type="primary"
              loading={isAdding || isUpdating}
              onClick={onSave}
            >
              保存
            </Button>
          </Space>
        )
      }
    >
      {!readonly && (
        <div className="mb-4">
          <Input
            placeholder="标题"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            size="large"
          />
        </div>
      )}

      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={index} className="flex items-center gap-2">
            {readonly ? (
              <>
                <Tag className="min-w-[60px] text-center">{field.label}</Tag>
                <span className="flex-1 break-all">{field.value}</span>
                <Button
                  icon={<CopyOutlined />}
                  size="small"
                  type="text"
                  onClick={() => onCopyField(field)}
                />
              </>
            ) : (
              <>
                <Input
                  className="w-24 flex-shrink-0"
                  placeholder="字段名"
                  value={field.label}
                  onChange={(e) => updateField(index, "label", e.target.value)}
                />
                <Input
                  className="flex-1"
                  placeholder="字段值"
                  value={field.value}
                  onChange={(e) => updateField(index, "value", e.target.value)}
                />
                <Button
                  icon={<DeleteOutlined />}
                  size="small"
                  danger
                  type="text"
                  onClick={() => removeField(index)}
                />
              </>
            )}
          </div>
        ))}
      </div>

      {!readonly && (
        <Button
          type="dashed"
          block
          className="mt-3"
          icon={<PlusOutlined />}
          onClick={addField}
        >
          添加字段
        </Button>
      )}
    </Modal>
  );
};

import { FC, useEffect, useMemo, useRef, useState } from "react";
import { Button, Form, Input, Modal } from "antd";
import {
  PlusOutlined,
  ExclamationCircleFilled,
  DeleteFilled,
} from "@ant-design/icons";
import {
  useCertificateDetail,
  useAddCertificate,
  useUpdateCertificate,
  useDeleteCertificate,
} from "@/services/certificate";
import { aes, aesDecrypt } from "@/utils/crypto";
import { useAtomValue } from "jotai";
import { stateMainPwd } from "@/store/user";
import { messageError, messageSuccess, messageWarning } from "@/utils/message";
import copy from "copy-to-clipboard";
import { Draggable } from "@/components/draggable";
import {
  CertificateFieldItem,
  type CertificateField,
} from "./certificate-field-item";

interface Props {
  groupId: number;
  detailId: number | undefined;
  onClose: () => void;
}

const getNewFormValues = () => ({
  title: "新密码",
  fields: [
    { label: "网址", value: "" },
    { label: "用户名", value: "" },
    { label: "密码", value: "" },
  ],
});

export const CertificateDetailModal: FC<Props> = ({
  groupId,
  detailId,
  onClose,
}) => {
  const isAdd = detailId === -1;
  const [form] = Form.useForm();
  const { pwdKey, pwdIv } = useAtomValue(stateMainPwd);
  const [readonly, setReadonly] = useState(true);
  const newFieldIndex = useRef(1);
  const { data: detailResp } = useCertificateDetail(
    isAdd ? undefined : detailId,
  );
  const { mutateAsync: addCertificate, isPending: isAdding } =
    useAddCertificate();
  const { mutateAsync: updateCertificate, isPending: isUpdating } =
    useUpdateCertificate();
  const { mutateAsync: deleteCertificate, isPending: isDeleting } =
    useDeleteCertificate();
  const isSaving = isAdding || isUpdating;

  useEffect(() => {
    if (!detailId) return;
    if (isAdd) {
      form.setFieldsValue(getNewFormValues());
      setReadonly(false);
    } else {
      setReadonly(true);
    }
  }, [detailId]);

  useEffect(() => {
    if (!detailResp?.data || !pwdKey || !pwdIv) return;

    const { content, name } = detailResp.data;
    try {
      const fields = JSON.parse(aesDecrypt(content, pwdKey, pwdIv));
      form.setFieldsValue({ title: name, fields });
    } catch {
      messageError("凭证解密失败");
      onClose();
    }
  }, [detailResp]);

  const onSave = async () => {
    const values = await form.validateFields();
    if (!values.title) {
      messageWarning("标题不能为空");
      return;
    }
    if (!pwdKey || !pwdIv) {
      messageWarning("主密码错误，请尝试重新登录");
      return;
    }

    const content = aes(JSON.stringify(values.fields), pwdKey, pwdIv);

    if (isAdd) {
      await addCertificate({ name: values.title, groupId, content });
    } else {
      await updateCertificate({
        id: detailId!,
        name: values.title,
        groupId,
        content,
      });
    }

    messageSuccess("保存成功");
    onClose();
  };

  /** 复制完整凭证内容 */
  const onCopyTotal = () => {
    Modal.confirm({
      title: "确定要复制完整凭证？",
      icon: <ExclamationCircleFilled />,
      content: "所有加密信息都将以明文展示，请确保索要凭证的人值得信赖。",
      onOk: async () => {
        const formData = form.getFieldsValue();
        let text = formData.title + "\n\n";
        formData.fields?.forEach((field: CertificateField) => {
          text += field.label + "\n" + field.value + "\n\n";
        });
        copy(text);
        messageSuccess("凭证已复制");
      },
    });
  };

  /** 删除凭证 */
  const onDeleteCertificate = () => {
    if (!detailId || detailId < 0) return;
    Modal.confirm({
      content: "确定删除该凭证吗？删除后将无法恢复",
      okText: "删除",
      okType: "danger",
      onOk: async () => {
        await deleteCertificate([detailId]);
        onClose();
      },
    });
  };

  const sortableOptions = useMemo(() => {
    return { disabled: readonly, handle: ".move-handle" };
  }, [readonly]);

  const renderTitle = () => {
    return (
      <div className="w-full flex items-center">
        <Form.Item noStyle name="title">
          <Input
            variant="borderless"
            disabled={readonly}
            placeholder="请输入密码名"
            className="font-bold text-xl pl-0 disabled:cursor-default disabled:text-inherit flex-1"
          />
        </Form.Item>
        {readonly && !isAdd && (
          <Button
            type="text"
            danger
            loading={isDeleting}
            icon={
              <DeleteFilled className="text-xl text-gray-500 dark:text-gray-200" />
            }
            data-testid="detail-delete-btn"
            onClick={onDeleteCertificate}
          />
        )}
      </div>
    );
  };

  const renderFooter = () => {
    const btns = [
      <Button key="back" onClick={onClose} data-testid="detail-back-btn">
        返回
      </Button>,
    ];

    if (readonly) {
      btns.push(
        <Button key="copy" onClick={onCopyTotal} data-testid="detail-copy-btn">
          复制
        </Button>,
        <Button
          key="edit"
          type="primary"
          onClick={() => setReadonly(false)}
          data-testid="detail-edit-btn"
        >
          编辑
        </Button>,
      );
    } else {
      btns.push(
        <Button
          key="save"
          type="primary"
          onClick={onSave}
          loading={isSaving}
          data-testid="detail-save-btn"
        >
          保存
        </Button>,
      );
    }

    return btns;
  };

  const renderDetailForm = () => {
    return (
      <Form.List name="fields">
        {(fields, { add, remove, move }) => (
          <>
            <Draggable
              value={fields}
              sortableOptions={sortableOptions}
              renderItem={(field) => (
                <Form.Item {...field} noStyle key={field.key}>
                  <CertificateFieldItem
                    disabled={readonly}
                    showDelete={fields.length > 1}
                    onDelete={() => remove(field.name)}
                  />
                </Form.Item>
              )}
              onChange={(_list, oldIndex, newIndex) => {
                move(oldIndex as number, newIndex as number);
              }}
            />
            {!readonly && (
              <Form.Item key="add">
                <Button
                  type="dashed"
                  onClick={() =>
                    add({
                      label: "字段" + newFieldIndex.current++,
                      value: "",
                    })
                  }
                  block
                  className="mt-4"
                  data-testid="detail-add-field-btn"
                  icon={<PlusOutlined />}
                >
                  新增字段
                </Button>
              </Form.Item>
            )}
          </>
        )}
      </Form.List>
    );
  };

  return (
    <Form form={form}>
      <Modal
        open={!!detailId}
        onCancel={onClose}
        closable={false}
        title={renderTitle()}
        footer={renderFooter()}
      >
        {renderDetailForm()}
      </Modal>
    </Form>
  );
};

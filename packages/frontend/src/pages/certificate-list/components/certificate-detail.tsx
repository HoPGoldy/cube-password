import { FC, useEffect, useMemo, useRef, useState } from "react";
import { Button, Form, Input, Modal, Space } from "antd";
import {
  PlusOutlined,
  ExclamationCircleFilled,
  DeleteFilled,
  SmileOutlined,
  HeartFilled,
  QuestionCircleFilled,
} from "@ant-design/icons";
import { ColorPicker, MARK_COLORS_MAP } from "@/components/color-picker";
import { IconPicker } from "@/components/icon-picker";
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

const USE_TIPS = [
  { name: "修改名称", content: "在编辑模式下，标题名和字段名均可修改。" },
  {
    name: "密码生成",
    content:
      '当字段名中包含 "密码"、"password"、"pwd" 时，将会显示密码生成按钮，点击后会生成 18 位的强密码并复制到剪切板。',
  },
  {
    name: "用户名",
    content:
      '当字段名中包含 "用户名"、"name" 时，将会显示用户名生成按钮，点击后会生成首字母大写的英文名并复制到剪切板。',
  },
  {
    name: "复制与跳转",
    content:
      "在查看凭证时，直接点击字段内容将会直接复制，如果内容以 http https 开头，将会直接跳转到对应网址。",
  },
];

const getNewFormValues = () => ({
  title: "新密码",
  icon: "fa-solid fa-key",
  markColor: "",
  fields: [
    { label: "网址", value: "" },
    { label: "用户名", value: "" },
    { label: "密码", value: "" },
  ],
});

/** 图标选择按钮 (Form.Item controlled) */
const IconSelectBtn: FC<{
  disabled: boolean;
  onOpen: () => void;
  value?: string;
}> = ({ onOpen, value }) => (
  <Button
    type="text"
    size="large"
    icon={
      <SmileOutlined className="text-2xl text-gray-500 dark:text-gray-200" />
    }
    onClick={onOpen}
  />
);

/** 颜色选择按钮 (Form.Item controlled) */
const ColorSelectBtn: FC<{
  disabled: boolean;
  onOpen: () => void;
  value?: string;
}> = ({ onOpen, value }) => (
  <Button
    type="text"
    size="large"
    icon={
      <HeartFilled
        style={{ color: value ? MARK_COLORS_MAP[value] : undefined }}
        className="text-2xl text-gray-500 dark:text-gray-200"
      />
    }
    onClick={onOpen}
  />
);

/** IconPicker 受控包装 */
const IconPickerController: FC<{
  open: boolean;
  onClose: () => void;
  value?: string;
  onChange?: (v: string) => void;
}> = ({ open, onClose, value, onChange }) => (
  <IconPicker
    value={value}
    onChange={onChange}
    visible={open}
    onClose={onClose}
  />
);

/** ColorPicker 受控包装 */
const ColorPickerController: FC<{
  open: boolean;
  onClose: () => void;
  value?: string;
  onChange?: (v: string) => void;
}> = ({ open, onClose, value, onChange }) => (
  <ColorPicker
    value={value}
    onChange={onChange}
    visible={open}
    onClose={onClose}
  />
);

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

    const { content, name, markColor, icon } = detailResp.data;
    try {
      const fields = JSON.parse(aesDecrypt(content, pwdKey, pwdIv));
      form.setFieldsValue({
        title: name,
        icon: icon || "fa-solid fa-key",
        markColor: markColor || "",
        fields,
      });
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
      await addCertificate({
        name: values.title,
        groupId,
        content,
        markColor: values.markColor || undefined,
        icon: values.icon || undefined,
      });
    } else {
      await updateCertificate({
        id: detailId!,
        name: values.title,
        groupId,
        content,
        markColor: values.markColor || null,
        icon: values.icon || null,
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

  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [useTipVisible, setUseTipVisible] = useState(false);

  const renderTitle = () => {
    return (
      <div className="w-full flex items-center" data-testid="detail-title">
        <Form.Item noStyle name="title">
          <Input
            variant="borderless"
            disabled={readonly}
            placeholder="请输入密码名"
            className="font-bold text-xl pl-0 disabled:cursor-default disabled:text-inherit flex-1"
          />
        </Form.Item>
        <div className="flex">
          <Space>
            {readonly && !isAdd ? (
              <Button
                type="text"
                danger
                size="large"
                loading={isDeleting}
                icon={
                  <DeleteFilled className="text-2xl text-gray-500 dark:text-gray-200" />
                }
                data-testid="detail-delete-btn"
                onClick={onDeleteCertificate}
              />
            ) : (
              !readonly && (
                <>
                  <Form.Item noStyle name="icon">
                    <IconSelectBtn
                      disabled={readonly}
                      onOpen={() => setIconPickerOpen(true)}
                    />
                  </Form.Item>
                  <Form.Item noStyle name="markColor">
                    <ColorSelectBtn
                      disabled={readonly}
                      onOpen={() => setColorPickerOpen(true)}
                    />
                  </Form.Item>
                  <Button
                    type="text"
                    size="large"
                    icon={
                      <QuestionCircleFilled className="text-2xl text-gray-500 dark:text-gray-200" />
                    }
                    onClick={() => setUseTipVisible(true)}
                  />
                </>
              )
            )}
          </Space>
        </div>

        <Form.Item noStyle name="icon">
          <IconPickerController
            open={iconPickerOpen}
            onClose={() => setIconPickerOpen(false)}
          />
        </Form.Item>
        <Form.Item noStyle name="markColor">
          <ColorPickerController
            open={colorPickerOpen}
            onClose={() => setColorPickerOpen(false)}
          />
        </Form.Item>

        <Modal
          open={useTipVisible}
          onCancel={() => setUseTipVisible(false)}
          footer={null}
          closable={false}
        >
          <div className="p-4">
            {USE_TIPS.map((tip) => (
              <div className="mb-4" key={tip.name}>
                <div className="font-bold mb-1 dark:text-gray-400">
                  {tip.name}
                </div>
                <div className="text-gray-600 dark:text-gray-200">
                  {tip.content}
                </div>
              </div>
            ))}
          </div>
        </Modal>
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

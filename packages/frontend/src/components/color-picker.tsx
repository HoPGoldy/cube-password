import { FC } from "react";
import { List, Modal } from "antd";

/** 颜色枚举对应的具体颜色 */
export const MARK_COLORS_MAP: Record<string, string> = {
  c1: "#ef4444",
  c2: "#f97316",
  c3: "#f59e0b",
  c4: "#eab308",
  c5: "#84cc16",
  c6: "#22c55e",
  c7: "#10b981",
  c8: "#14b8a6",
  c9: "#06b6d4",
  c10: "#0ea5e9",
  c11: "#3b82f6",
  c12: "#6366f1",
  c13: "#8b5cf6",
  c14: "#a855f7",
  c15: "#d946ef",
  c16: "#ec4899",
};

const MARK_COLORS_WITH_EMPTY = [
  "c1",
  "c2",
  "c3",
  "c4",
  "c5",
  "c6",
  "c7",
  "c8",
  "c9",
  "c10",
  "c11",
  "c12",
  "c13",
  "c14",
  "c15",
  "c16",
  "",
];

const MARK_COLORS = MARK_COLORS_WITH_EMPTY.slice(0, -1);

interface ColorItemProps {
  colorCode: string;
  selected: boolean;
  onClick: (colorCode: string) => void;
}

const ColorItem: FC<ColorItemProps> = ({ colorCode, selected, onClick }) => {
  const classes = [
    "w-6 h-6 rounded-full cursor-pointer hover:ring-4 hover:ring-gray-300 dark:ring-neutral-500 transition m-auto",
  ];
  if (selected)
    classes.push("ring-4 ring-gray-700 dark:ring-gray-300 hover:ring-gray-700");
  if (colorCode === "")
    classes.push(
      "border-2 border-solid border-red-500 relative overflow-hidden " +
        "after:content-[''] after:bg-red-500 after:absolute after:-left-px after:top-[10px] after:w-[25px] after:h-[2px] after:rotate-45",
    );

  return (
    <List.Item key={colorCode}>
      <div
        className={classes.join(" ")}
        style={{ backgroundColor: MARK_COLORS_MAP[colorCode] }}
        onClick={() => onClick(colorCode)}
      />
    </List.Item>
  );
};

interface Props {
  value?: string;
  onChange?: (value: string) => void;
  visible: boolean;
  onClose: () => void;
}

export const ColorPicker: FC<Props> = ({
  value,
  onChange,
  visible,
  onClose,
}) => {
  return (
    <Modal open={visible} onCancel={onClose} footer={null} closable={false}>
      <List
        className="mt-6"
        grid={{ gutter: 16, column: 6 }}
        dataSource={MARK_COLORS_WITH_EMPTY}
        renderItem={(colorCode) => (
          <ColorItem
            colorCode={colorCode}
            selected={value === colorCode}
            onClick={(c) => {
              onChange?.(c || "");
              onClose();
            }}
          />
        )}
      />
    </Modal>
  );
};

interface ColorMultiplePickerProps {
  value?: string[];
  onChange?: (value: string[]) => void;
}

export const ColorMultiplePicker: FC<ColorMultiplePickerProps> = ({
  value = [],
  onChange,
}) => {
  const onClickItem = (colorCode: string) => {
    if (value.includes(colorCode)) {
      onChange?.(value.filter((c) => c !== colorCode));
    } else {
      onChange?.([...value, colorCode]);
    }
  };

  return (
    <List
      className="mt-2"
      grid={{ gutter: 16, xs: 6, sm: 6, md: 8, lg: 16, xl: 16, xxl: 16 }}
      dataSource={MARK_COLORS}
      renderItem={(colorCode) => (
        <ColorItem
          colorCode={colorCode}
          selected={value.includes(colorCode)}
          onClick={onClickItem}
        />
      )}
    />
  );
};

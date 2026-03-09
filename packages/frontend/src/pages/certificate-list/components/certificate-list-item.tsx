import { FC } from "react";
import { Card, Checkbox } from "antd";
import dayjs from "dayjs";

interface CertificateItem {
  id: number;
  name: string;
  markColor: string | null;
  icon: string | null;
  updatedAt: string;
}

interface Props {
  detail: CertificateItem;
  onClick: () => void;
  /** undefined = not in select mode, boolean = select state */
  selected?: boolean;
  dragging?: boolean;
}

export const CertificateListItem: FC<Props> = ({
  detail,
  onClick,
  selected,
  dragging,
}) => {
  const { name, markColor, icon, updatedAt } = detail;

  return (
    <div
      className={`relative md:mx-2 mb-4 w-full md:w-col-1 lg:w-col-2 xl:w-col-3 inline-block ${dragging ? "after:content-[''] after:absolute after:inset-0" : ""}`}
      data-testid={`certificate-item-${detail.id}`}
    >
      <Card
        size="small"
        className={`ring-gray-300 dark:ring-gray-600 active:bg-gray-100 dark:active:bg-gray-700 transition hover:ring active:ring-0 cursor-pointer ${selected ? "ring" : ""}`}
        onClick={onClick}
      >
        <div className="flex items-center">
          {icon && (
            <div className="w-[56px] absolute text-center">
              <i
                className={`${icon} text-[38px] text-gray-700 dark:text-gray-200`}
              />
            </div>
          )}

          <div className={icon ? "ml-[68px]" : ""}>
            <div
              className="font-bold text-lg text-ellipsis whitespace-nowrap overflow-hidden"
              data-testid="certificate-item-name"
            >
              {name}
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              {dayjs(updatedAt).format("YYYY-MM-DD HH:mm:ss")}
            </div>
          </div>

          {/* Selection checkbox */}
          {selected !== undefined && (
            <Checkbox
              checked={selected}
              className="absolute h-4 w-4 right-4 top-[30%] scale-150"
            />
          )}

          {/* Color mark */}
          {selected === undefined && markColor && (
            <div
              className="absolute h-4 w-4 right-4 top-[38%] rounded-full"
              style={{ backgroundColor: markColor }}
            />
          )}
        </div>
      </Card>
    </div>
  );
};

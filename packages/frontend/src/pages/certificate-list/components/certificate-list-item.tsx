import { FC } from "react";
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
}

export const CertificateListItem: FC<Props> = ({ detail, onClick }) => {
  const { name, markColor, updatedAt } = detail;

  return (
    <div
      className="flex items-center px-4 py-3 hover:bg-gray-50 dark:hover:bg-neutral-700 cursor-pointer border-b border-gray-100 dark:border-neutral-700"
      onClick={onClick}
    >
      {markColor && (
        <div
          className="w-2 h-2 rounded-full mr-3 flex-shrink-0"
          style={{ backgroundColor: markColor }}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium">{name}</div>
        <div className="text-xs text-gray-400 mt-1">
          {dayjs(updatedAt).format("YYYY-MM-DD HH:mm")}
        </div>
      </div>
    </div>
  );
};

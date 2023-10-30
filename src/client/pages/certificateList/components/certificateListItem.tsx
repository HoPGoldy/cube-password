import { Card, Checkbox } from 'antd';
import React, { FC, useRef } from 'react';
import s from '../styles.module.css';
import { CertificateListItem } from '@/types/group';
import { MARK_COLORS_MAP } from '@/client/components/colorPicker';
import { useAtomValue } from 'jotai';
import { stateAppConfig } from '@/client/store/global';

interface CertificateListItemProps {
  detail: CertificateListItem;
  isSelected?: boolean;
  selectMode?: boolean;
  onClick: () => void;
  onLongClick?: () => void;
  dragging?: boolean;
}

export const CertificateListDetail: FC<CertificateListItemProps> = (props) => {
  const { detail, isSelected = false, selectMode = false, dragging = false, onClick } = props;
  /** 主题色 */
  const primaryColor = useAtomValue(stateAppConfig)?.primaryColor;
  /** 长按计时器 */
  const longClickTimer = useRef<NodeJS.Timeout>();

  // 渲染凭证列表项右侧的标记
  const renderRightMark = () => {
    // 编辑模式下右侧的小方块
    if (selectMode)
      return (
        <Checkbox
          className='absolute h-4 w-4 right-4 top-[30%] scale-150'
          checked={isSelected}></Checkbox>
      );

    if (detail.markColor)
      return (
        <div
          className='absolute h-4 w-4 right-4 top-[38%] rounded-full'
          style={{ backgroundColor: MARK_COLORS_MAP[detail.markColor] }}></div>
      );

    return null;
  };

  const onLongClick = () => {
    longClickTimer.current = setTimeout(() => {
      props.onLongClick?.();
    }, 500);
  };

  const onLongClickEnd = () => {
    clearTimeout(longClickTimer.current);
  };

  return (
    <div className={`${s.listItemContainer} ${dragging ? s.itemWrapDrag : ''}`} key={detail.id}>
      <Card
        size='small'
        className={`${s.listItem} ${isSelected ? 'ring' : undefined}`}
        style={{
          borderColor: isSelected ? primaryColor : undefined,
          ['--tw-ring-color' as string]: isSelected ? primaryColor : undefined,
        }}
        onClick={onClick}
        onTouchStart={onLongClick}
        onTouchEnd={onLongClickEnd}>
        <div className='flex items-center'>
          {detail.icon && (
            <div className='mr-3 absolute'>
              <i className={`${detail.icon} text-[38px] text-gray-700`} />
            </div>
          )}

          <div className={detail.icon ? 'ml-12' : ''}>
            <div className='font-bold text-lg text-ellipsis whitespace-nowrap overflow-hidden'>
              {detail.name}
            </div>
            <div className='text-gray-600 dark:text-gray-400'>{detail.updateTime}</div>
          </div>

          {renderRightMark()}
        </div>
      </Card>
    </div>
  );
};

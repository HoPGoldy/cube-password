import { ReactElement, useEffect, useRef } from "react";
import Sortable from "sortablejs";
import cloneDeep from "lodash/cloneDeep";

interface DraggableProps<T> {
  value: T[];
  onChange: (
    value: T[],
    oldIndex: number | undefined,
    newIndex: number | undefined,
  ) => void;
  renderItem: (item: T, index: number) => ReactElement | null;
  extra?: ReactElement;
  className?: string;
  sortableOptions?: Sortable.Options;
}

const DEFAULT_SORTABLE_OPTIONS: Sortable.Options = {};

export const Draggable: <T>(props: DraggableProps<T>) => ReactElement = (
  props,
) => {
  const {
    value,
    onChange,
    className,
    renderItem,
    extra,
    sortableOptions = DEFAULT_SORTABLE_OPTIONS,
  } = props;
  const sortableDomRef = useRef<HTMLDivElement | null>(null);
  const sortableRef = useRef<Sortable | null>(null);

  const onEnd = (e: Sortable.SortableEvent) => {
    sortableOptions?.onEnd?.(e);
    const { oldIndex, newIndex } = e;
    if (oldIndex == null && newIndex == null) {
      return;
    }
    if (oldIndex === newIndex) return;

    const newValue = cloneDeep(value);
    const [removed] = newValue.splice(oldIndex || 0, 1);
    newValue.splice(newIndex || 0, 0, removed);

    onChange(newValue, oldIndex, newIndex);
  };

  const getFullOptions = () => {
    return {
      ...DEFAULT_SORTABLE_OPTIONS,
      ...sortableOptions,
      onEnd,
    };
  };

  useEffect(() => {
    if (!sortableDomRef.current) return;

    sortableRef.current = Sortable.create(sortableDomRef.current, {
      animation: 150,
      ...getFullOptions(),
    });
  }, []);

  useEffect(() => {
    if (!sortableRef.current) return;
    Object.entries(getFullOptions()).forEach(([key, value]) => {
      sortableRef.current?.option(key as keyof Sortable.Options, value);
    });
  }, [sortableOptions]);

  return (
    <div ref={sortableDomRef} className={className}>
      {value.map(renderItem)}
      {extra}
    </div>
  );
};

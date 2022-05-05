import { isObject } from '../util/lang';
import { XataRecord } from './record';
import { SelectableColumn } from './selection';

export type SortDirection = 'asc' | 'desc';
export type SortFilterExtended<T extends XataRecord> = {
  column: SelectableColumn<T>;
  direction?: SortDirection;
};

export type SortFilter<T extends XataRecord> = SelectableColumn<T> | SortFilterExtended<T>;

export function isSortFilterObject<T extends XataRecord>(filter: SortFilter<T>): filter is SortFilterExtended<T> {
  return isObject(filter) && filter.column !== undefined;
}

export function buildSortFilter<T extends XataRecord>(
  filter?: SortFilter<T> | SortFilter<T>[]
): { [key: string]: SortDirection } | undefined {
  if (!filter) return undefined;

  const filters: SortFilter<T>[] = Array.isArray(filter) ? filter : [filter];

  return filters.reduce((acc, item) => {
    if (typeof item === 'string') {
      return { ...acc, [item]: 'asc' };
    } else if (isSortFilterObject(item)) {
      return { ...acc, [item.column]: item.direction };
    } else {
      return acc;
    }
  }, {});
}

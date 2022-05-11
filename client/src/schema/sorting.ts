import { isObject, isString } from '../util/lang';
import { SingleOrArray, Values } from '../util/types';
import { XataRecord } from './record';
import { SelectableColumn } from './selection';

export type SortDirection = 'asc' | 'desc';
export type SortFilterExtended<T extends XataRecord> = {
  column: SelectableColumn<T>;
  direction?: SortDirection;
};

export type SortFilter<T extends XataRecord> = SelectableColumn<T> | SortFilterExtended<T>;

export type ApiSortFilter<T extends XataRecord> = SingleOrArray<
  Values<{
    [key in SelectableColumn<T>]: { [K in key]: SortDirection };
  }>
>;

export function isSortFilterString<T extends XataRecord>(value: any): value is SelectableColumn<T> {
  return isString(value);
}

export function isSortFilterObject<T extends XataRecord>(filter: SortFilter<T>): filter is SortFilterExtended<T> {
  return isObject(filter) && filter.column !== undefined;
}

export function buildSortFilter<T extends XataRecord>(filter: SingleOrArray<SortFilter<T>>): ApiSortFilter<T> {
  if (isSortFilterString(filter)) {
    return { [filter]: 'asc' } as { [key in SelectableColumn<T>]: SortDirection };
  } else if (Array.isArray(filter)) {
    return filter.map((item) => buildSortFilter(item)) as { [key in SelectableColumn<T>]: SortDirection }[];
  } else if (isSortFilterObject(filter)) {
    return { [filter.column]: filter.direction ?? 'asc' } as { [key in SelectableColumn<T>]: SortDirection };
  } else {
    throw new Error(`Invalid sort filter: ${filter}`);
  }
}

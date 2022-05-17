import { isObject, isString } from '../util/lang';
import { SingleOrArray, StringKeys, Values } from '../util/types';
import { XataRecord } from './record';
import { SelectableColumn } from './selection';

export type SortDirection = 'asc' | 'desc';
export type SortFilterExtended<T extends XataRecord> = {
  column: SelectableColumn<T>;
  direction?: SortDirection;
};

export type SortFilter<T extends XataRecord> = SelectableColumn<T> | SortFilterExtended<T> | SortFilterBase<T>;

type SortFilterBase<T extends XataRecord> = {
  [Key in StringKeys<T>]: SortDirection;
};

export type ApiSortFilter<T extends XataRecord> = SingleOrArray<
  Values<{
    [Key in SelectableColumn<T>]: { [K in Key]: SortDirection };
  }>
>;

export function isSortFilterString<T extends XataRecord>(value: any): value is SelectableColumn<T> {
  return isString(value);
}

export function isSortFilterBase<T extends XataRecord>(filter: SortFilter<T>): filter is SortFilterBase<T> {
  return isObject(filter) && Object.values(filter).every((value) => value === 'asc' || value === 'desc');
}

export function isSortFilterObject<T extends XataRecord>(filter: SortFilter<T>): filter is SortFilterExtended<T> {
  return isObject(filter) && !isSortFilterBase(filter) && filter.column !== undefined;
}

export function buildSortFilter<T extends XataRecord>(filter: SingleOrArray<SortFilter<T>>): ApiSortFilter<T> {
  if (isSortFilterString(filter)) {
    return { [filter]: 'asc' } as { [key in SelectableColumn<T>]: SortDirection };
  } else if (Array.isArray(filter)) {
    return filter.map((item) => buildSortFilter(item)) as { [key in SelectableColumn<T>]: SortDirection }[];
  } else if (isSortFilterBase(filter)) {
    return filter as { [key in SelectableColumn<T>]: SortDirection };
  } else if (isSortFilterObject(filter)) {
    return { [filter.column]: filter.direction ?? 'asc' } as { [key in SelectableColumn<T>]: SortDirection };
  } else {
    throw new Error(`Invalid sort filter: ${filter}`);
  }
}

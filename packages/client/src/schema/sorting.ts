import { isObject, isString } from '../util/lang';
import { SingleOrArray, Values } from '../util/types';
import { XataRecord } from './record';
import { ColumnsByValue } from './selection';

export type SortDirection = 'asc' | 'desc';

type RandomFilter = { '*': 'random' };
type RandomFilterExtended = { column: '*'; direction: 'random' };

export type SortFilterExtended<T extends XataRecord, Columns extends string = ColumnsByValue<T, any>> =
  | RandomFilterExtended
  | {
      column: Columns;
      direction?: SortDirection;
    };

export type SortFilter<T extends XataRecord, Columns extends string = ColumnsByValue<T, any>> =
  | Columns
  | SortFilterExtended<T, Columns>
  | SortFilterBase<T, Columns>
  | RandomFilter;

type SortFilterBase<T extends XataRecord, Columns extends string = ColumnsByValue<T, any>> = Values<{
  [Key in Columns]: { [K in Key]: SortDirection };
}>;

export type ApiSortFilter<T extends XataRecord, Columns extends string = ColumnsByValue<T, any>> = SingleOrArray<
  | RandomFilter
  | Values<{
      [Key in Columns]: { [K in Key]: SortDirection };
    }>
>;

export function isSortFilterString<T extends XataRecord>(value: any): value is ColumnsByValue<T, any> {
  return isString(value);
}

export function isSortFilterBase<T extends XataRecord>(filter: SortFilter<T, any>): filter is SortFilterBase<T> {
  return isObject(filter) && Object.values(filter).every((value) => value === 'asc' || value === 'desc');
}

export function isSortFilterObject<T extends XataRecord>(filter: SortFilter<T, any>): filter is SortFilterExtended<T> {
  return isObject(filter) && !isSortFilterBase(filter) && filter.column !== undefined;
}

export function buildSortFilter<T extends XataRecord>(
  filter: SingleOrArray<SortFilter<T, any>>
): ApiSortFilter<T, any> {
  if (isSortFilterString(filter)) {
    return { [filter]: 'asc' } as { [key in ColumnsByValue<T, any>]: SortDirection };
  } else if (Array.isArray(filter)) {
    return filter.map((item) => buildSortFilter(item)) as { [key in ColumnsByValue<T, any>]: SortDirection }[];
  } else if (isSortFilterBase(filter)) {
    return filter as { [key in ColumnsByValue<T, any>]: SortDirection };
  } else if (isSortFilterObject(filter)) {
    return { [filter.column]: filter.direction ?? 'asc' } as { [key in ColumnsByValue<T, any>]: SortDirection };
  } else {
    throw new Error(`Invalid sort filter: ${filter}`);
  }
}

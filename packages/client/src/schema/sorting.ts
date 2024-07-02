import { isObject, isString } from '../util/lang';
import { SingleOrArray, Values } from '../util/types';
import { ColumnsByValue } from './selection';

export type SortDirection = 'asc' | 'desc';

type RandomFilter = { '*': 'random' };
type RandomFilterExtended = { column: '*'; direction: 'random' };

export type SortColumns<T> = ColumnsByValue<T, any>;

export type SortFilterExtended<T, Columns extends string = SortColumns<T>> =
  | RandomFilterExtended
  | {
      column: Columns;
      direction?: SortDirection;
    };

export type SortFilter<T, Columns extends string = SortColumns<T>> =
  | Columns
  | SortFilterExtended<T, Columns>
  | SortFilterBase<T, Columns>
  | RandomFilter;

type SortFilterBase<T, Columns extends string = SortColumns<T>> = Values<{
  [Key in Columns]: { [K in Key]: SortDirection };
}>;

export type ApiSortFilter<T, Columns extends string = SortColumns<T>> = SingleOrArray<
  | RandomFilter
  | Values<{
      [Key in Columns]: { [K in Key]: SortDirection };
    }>
>;

export function isSortFilterString<T>(value: any): value is SortColumns<T> {
  return isString(value);
}

export function isSortFilterBase<T>(filter: SortFilter<T, any>): filter is SortFilterBase<T> {
  return (
    isObject(filter) &&
    Object.entries(filter).every(([key, value]) => {
      // Check for the random sorting operator
      if (key === '*') return value === 'random';

      return value === 'asc' || value === 'desc';
    })
  );
}

export function isSortFilterObject<T>(filter: SortFilter<T, any>): filter is SortFilterExtended<T> {
  return isObject(filter) && !isSortFilterBase(filter) && filter.column !== undefined;
}

export function buildSortFilter<T>(filter: SingleOrArray<SortFilter<T, any>>): ApiSortFilter<T, any> {
  if (isSortFilterString(filter)) {
    return { [filter]: 'asc' } as { [key in SortColumns<T>]: SortDirection };
  } else if (Array.isArray(filter)) {
    return filter.map((item) => buildSortFilter(item)) as { [key in SortColumns<T>]: SortDirection }[];
  } else if (isSortFilterBase(filter)) {
    return filter as { [key in SortColumns<T>]: SortDirection };
  } else if (isSortFilterObject(filter)) {
    return { [filter.column]: filter.direction ?? 'asc' } as { [key in SortColumns<T>]: SortDirection };
  } else {
    throw new Error(`Invalid sort filter: ${filter}`);
  }
}

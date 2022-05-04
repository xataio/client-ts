import { isObject } from '../util/lang';

export type SortDirection = 'asc' | 'desc';
export type SortFilterExtended<T> = {
  column: keyof T;
  direction?: SortDirection;
};

export type SortFilter<T> = SortFilterExtended<T> | keyof T;

export function isSortFilterObject<T>(filter: SortFilter<T>): filter is SortFilterExtended<T> {
  return isObject(filter) && filter.column !== undefined;
}

export type FilterOperator =
  | '$gt'
  | '$lt'
  | '$ge'
  | '$le'
  | '$exists'
  | '$notExists'
  | '$endsWith'
  | '$startsWith'
  | '$pattern'
  | '$is'
  | '$isNot'
  | '$contains'
  | '$includes'
  | '$includesSubstring'
  | '$includesPattern'
  | '$includesAll';

export function buildSortFilter<T>(
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

// TODO: restrict constraints depending on type?
// E.g. startsWith cannot be used with numbers
export type Constraint<T> = { [key in FilterOperator]?: T };

export type DeepConstraint<T> = T extends Record<string, any>
  ? {
      [key in keyof T]?: T[key] | DeepConstraint<T[key]>;
    }
  : Constraint<T>;

export type FilterConstraints<T> = {
  [key in keyof T]?: T[key] extends Record<string, any> ? FilterConstraints<T[key]> : T[key] | DeepConstraint<T[key]>;
};

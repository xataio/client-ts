import { SingleOrArray } from '../util/types';
import { SelectableColumn, ValueAtColumn } from './selection';

/**
 * PropertyMatchFilter
 * Example:
{
  "filter": {
    "name": "value",
    "name": {
       "$is":  "value",
       "$any": [ "value1", "value2" ],
    },
    "settings.plan": {"$any": ["free", "paid"]},
    "settings.plan": "free",
    "settings": {
      "plan": "free"
    },
  }
}
*/
type PropertyAccessFilter<Record> = {
  [key in SelectableColumn<Record>]?:
    | NestedApiFilter<ValueAtColumn<Record, key>>
    | PropertyFilter<ValueAtColumn<Record, key>>;
};

export type PropertyFilter<T> = T | { $is: T } | { $isNot: T } | { $any: T[] } | { $none: T[] } | ValueTypeFilters<T>;

type IncludesFilter<T> =
  | PropertyFilter<T>
  | {
      [key in '$all' | '$none' | '$any']?: IncludesFilter<T> | Array<IncludesFilter<T> | { $not: IncludesFilter<T> }>;
    };

export type StringTypeFilter = { [key in '$contains' | '$pattern' | '$startsWith' | '$endsWith']?: string };
export type ComparableType = number | Date;
export type ComparableTypeFilter<T extends ComparableType> = { [key in '$gt' | '$lt' | '$ge' | '$le']?: T };
export type ArrayFilter<T> =
  | {
      [key in '$includes']?: SingleOrArray<PropertyFilter<T> | ValueTypeFilters<T>> | IncludesFilter<T>;
    }
  | {
      [key in '$includesAll' | '$includesNone' | '$includesAny']?:
        | T
        | Array<PropertyFilter<T> | { $not: PropertyFilter<T> }>;
    };

type ValueTypeFilters<T> = T | T extends string
  ? StringTypeFilter
  : T extends number
  ? ComparableTypeFilter<number>
  : T extends Date
  ? ComparableTypeFilter<Date>
  : T extends Array<infer T>
  ? ArrayFilter<T>
  : never;

/**
 * AggregatorFilter
 * Example:
{
  "filter": {
      "$any": {
        "settings.dark": true,
        "settings.plan": "free"
      }
  },
}
{
  "filter": {
    "$any": [
      {
        "name": "r1",
      },
      {
        "name": "r2",
      },
    ],
}
*/
type AggregatorFilter<T> = {
  [key in '$all' | '$any' | '$not' | '$none']?: SingleOrArray<Filter<T>>;
};

/**
 * Existance filter
 * Example: { filter: { $exists: "settings" } }
 */
export type ExistanceFilter<Record> = {
  [key in '$exists' | '$notExists']?: SelectableColumn<Record>;
};

type BaseApiFilter<Record> = PropertyAccessFilter<Record> | AggregatorFilter<Record> | ExistanceFilter<Record>;

/**
 * Nested filter
 * Injects the Api filters on nested properties
 * Example: { filter: { settings: { plan: { $any: ['free', 'trial'] } } } }
 */
type NestedApiFilter<T> = {
  [key in keyof T]?: T[key] extends Record<string, any> ? SingleOrArray<Filter<T[key]>> : PropertyFilter<T[key]>;
};

export type Filter<T> = T extends Record<string, any>
  ? T extends (infer ArrayType)[] // Arrays have a special filter
    ? ArrayType | ArrayType[] | ArrayFilter<ArrayType> | ArrayFilter<ArrayType[]>
    : T extends Date // Date extends object but we treat it as a primitive
    ? PropertyFilter<T>
    : BaseApiFilter<T> | NestedApiFilter<T>
  : PropertyFilter<T>;

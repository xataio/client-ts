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
  [key in SelectableColumn<Record>]?: Partial<ValueAtColumn<Record, key>> | PropertyFilter<ValueAtColumn<Record, key>>;
};

type PropertyFilter<T> = T | { $is: T } | { $isNot: T } | { $any: T[] } | { $none: T[] } | ValueTypeFilters<T>;

type IncludesFilter<T> =
  | PropertyFilter<T>
  | {
      [key in '$all' | '$none' | '$any']?: IncludesFilter<T> | Array<IncludesFilter<T> | { $not: IncludesFilter<T> }>;
    };

type ValueTypeFilters<T> = T | T extends string
  ? { [key in '$contains' | '$pattern' | '$startsWith' | '$endsWith']?: string }
  : T extends number
  ? { [key in '$gt' | '$lt' | '$ge' | '$le']?: number }
  : T extends Array<infer T>
  ?
      | {
          [key in '$includes']?: SingleOrArray<PropertyFilter<T> | ValueTypeFilters<T>> | IncludesFilter<T>;
        }
      | {
          [key in '$includesAll' | '$includesNone' | '$includesAny']?:
            | T
            | Array<PropertyFilter<T> | { $not: PropertyFilter<T> }>;
        }
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
type AggregatorFilter<Record> = {
  [key in '$all' | '$any' | '$not' | '$none']?: SingleOrArray<FilterObject<Record>>;
};

/**
 * Existance filter
 * Example: { filter: { $exists: "settings" } }
 */
type ExistanceFilter<Record> = {
  [key in '$exists' | '$notExists']?: SelectableColumn<Record>;
};

type BaseApiFilter<Record> = PropertyAccessFilter<Record> | AggregatorFilter<Record> | ExistanceFilter<Record>;

/**
 * Nested filter
 * Injects the Api filters on nested properties
 * Example: { filter: { settings: { plan: { $any: ['free', 'trial'] } } } }
 */
type NestedApiFilter<T> = T extends Record<string, any>
  ? { [key in keyof T]?: T[key] extends Record<string, any> ? SingleOrArray<FilterObject<T[key]>> : T[key] }
  : T;

export type FilterObject<Record> = BaseApiFilter<Record> | NestedApiFilter<Record>;

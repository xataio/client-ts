import { SingleOrArray } from '../util/types';
import { SelectableColumn, ValueAtColumn } from './selection';

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
  [key in '$all' | '$any' | '$not' | '$none']?: SingleOrArray<ApiFilter<Record>>;
};

/**
 * Existance filter
 * Example: { filter: { $exists: "settings" } }
 */
type ExistanceFilter<Record> = {
  [key in '$exists' | '$notExists']?: SelectableColumn<Record>;
};

type BaseApiFilter<Record> = PropertyAccessFilter<Record> | AggregatorFilter<Record> | ExistanceFilter<Record>;

export type ApiFilter<Record> = BaseApiFilter<Record> | NestedApiFilter<Record>;

/**
 * Nested filter
 * Injects the Api filters on nested properties
 * Example: { filter: { settings: { plan: { $any: ['free', 'trial'] } } } }
 */
type NestedApiFilter<T> = T extends Record<string, any>
  ? { [key in keyof T]?: SingleOrArray<ApiFilter<T[key]> | NestedApiFilter<T[key]>> }
  : BaseApiFilter<T>;

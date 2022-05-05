import { XataRecord } from './record';
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
type PropertyAccessFilter<Record extends XataRecord> = {
  [key in SelectableColumn<Record>]?:
    | Partial<ValueAtColumn<Record, key>>
    | ValueTypeFilters<Record, ValueAtColumn<Record, key>>
    | { $is: ValueAtColumn<Record, key> }
    | { $isNot: ValueAtColumn<Record, key> }
    | { $any: ValueAtColumn<Record, key>[] };
};

type ValueTypeFilters<Record extends XataRecord, T> = T extends string
  ? { [key in '$contains' | '$pattern' | '$startsWith' | '$endsWith']?: string }
  : T extends number
  ? { [key in '$gt' | '$lt' | '$ge' | '$le']?: number }
  : T extends Array<infer T>
  ?
      | {
          [key in '$includes']?:
            | T
            | T[]
            | {
                [key in '$all' | '$none' | '$any']?: Array<
                  ValueTypeFilters<Record, T> | { $not: ValueTypeFilters<Record, T> }
                >;
              };
        }
      | {
          [key in '$includesAll' | '$includesNone' | '$includesAny']?: Array<
            ValueTypeFilters<Record, T> | { $not: ValueTypeFilters<Record, T> }
          >;
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
type AggregatorFilter<Record extends XataRecord> = {
  [key in '$all' | '$any' | '$not' | '$none']?: ApiFilter<Record> | ApiFilter<Record>[];
};

/**
 * Existance filter
 * Example:
{
  "filter": {
    "$exists": "settings",
  },
}
*/
type ExistanceFilter<Record extends XataRecord> = {
  [key in '$exists' | '$notExists']?: SelectableColumn<Record>;
};

export type ApiFilter<Record extends XataRecord> =
  | PropertyAccessFilter<Record>
  | AggregatorFilter<Record>
  | ExistanceFilter<Record>;

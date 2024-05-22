import { BinaryOperatorExpression } from 'kysely/dist/cjs/parser/binary-operation-parser';
import { FilterExpression, FilterPredicate } from '../api/schemas';
import { isDefined, isObject, isString } from '../util/lang';
import { SingleOrArray, Values } from '../util/types';
import { JSONValue } from './json';
import { ColumnsByValue, ValueAtColumn } from './selection';
import { ExpressionOrFactory, sql } from 'kysely';

export type JSONFilterColumns<Record> = Values<{
  [K in keyof Record]: NonNullable<Record[K]> extends JSONValue<any>
    ? K extends string
      ? `${K}->${string}`
      : never
    : never;
}>;

export type FilterColumns<T> = ColumnsByValue<T, any>;

export type FilterValueAtColumn<Record, F> = NonNullable<ValueAtColumn<Record, F>> extends JSONValue<any>
  ? PropertyFilter<any>
  : Filter<NonNullable<ValueAtColumn<Record, F>>>;

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
  }
}
*/
type PropertyAccessFilter<Record> = {
  [key in FilterColumns<Record>]?:
    | NestedApiFilter<ValueAtColumn<Record, key>>
    | PropertyFilter<ValueAtColumn<Record, key>>;
} & {
  [key in JSONFilterColumns<Record>]?: PropertyFilter<Record[keyof Record]>;
};

export type PropertyFilter<T> = T | { $is: T } | { $isNot: T } | { $any: T[] } | { $none: T[] } | ValueTypeFilters<T>;

type IncludesFilter<T> =
  | PropertyFilter<T>
  | {
      [key in '$all' | '$none' | '$any']?: IncludesFilter<T> | Array<IncludesFilter<T> | { $not: IncludesFilter<T> }>;
    };

export type StringTypeFilter = {
  [key in '$contains' | '$iContains' | '$pattern' | '$iPattern' | '$startsWith' | '$endsWith']?: string;
};
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
        "dark": true,
        "plan": "free"
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
 * Example: { filter: { $exists: "dark" } }
 */
export type ExistanceFilter<Record> = {
  [key in '$exists' | '$notExists']?: FilterColumns<Record>;
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

export function cleanFilter(filter?: FilterExpression | FilterPredicate): any {
  if (!isDefined(filter)) return undefined;
  if (!isObject(filter)) return filter;

  const values = Object.fromEntries(
    Object.entries(filter).reduce((acc, [key, value]) => {
      // Remove null and undefined values
      if (!isDefined(value)) return acc;

      if (Array.isArray(value)) {
        // Remove empty objects from arrays
        const clean = value.map((item) => cleanFilter(item)).filter((item) => isDefined(item));

        // Remove empty arrays
        if (clean.length === 0) return acc;

        return [...acc, [key, clean]];
      }

      if (isObject(value)) {
        // Remove empty objects
        const clean = cleanFilter(value);
        if (!isDefined(clean)) return acc;

        return [...acc, [key, clean]];
      }

      return [...acc, [key, value]];
    }, [] as [string, any][])
  );

  return Object.keys(values).length > 0 ? values : undefined;
}

export const filterToKysely = (
  filter: Filter<any>,
  latestKey?: string,
  latestOperator?: string
): ExpressionOrFactory<any, any, any> => {
  return ({ eb, and, or, not }) => {
    if (isString(filter) || typeof filter === 'number' || filter instanceof Date) {
      const computedOperator = latestOperator ?? '=';
      const computedKey = eb.ref(latestKey ?? 'unknown');
      if (computedOperator === '$contains') {
        return sql`(position(${filter} IN ${computedKey})>0)`;
      } else if (computedOperator === '$iContains') {
        return sql`(position(lower(${filter}) IN lower(${computedKey}))>0)`;
      } else if (computedOperator === '$includes') {
        return sql`(true = ANY(SELECT "tmp"=${filter} FROM unnest(${computedKey}) as tmp))`;
      } else if (computedOperator === '$includesNone') {
        return sql`(false = ALL(SELECT "tmp"=${filter} FROM unnest(${computedKey}) as tmp))`;
      } else if (computedOperator === '$includesAll') {
        // TODO why does this have to be ANY to pass. should be all?
        return sql`(true = ANY(SELECT "tmp"=${filter} FROM unnest(${computedKey}) as tmp))`;
      } else if (computedOperator === '$startsWith') {
        return sql`(starts_with(${computedKey}, ${filter}))`;
      } else if (computedOperator === '$endsWith') {
        return sql`(${computedKey} LIKE %${filter}%)`;
      } else if (computedOperator === '$lt') {
        return sql`${computedKey} < ${filter}`;
      } else if (computedOperator === '$lte') {
        return sql`${computedKey} <= ${filter}`;
      } else if (computedOperator === '$gt') {
        return sql`${computedKey} > ${filter}`;
      } else if (computedOperator === '$gte') {
        return sql`${computedKey} >= ${filter}`;
      } else {
        // TODO is null, match pattern, in, not in, exists,
        return eb(computedKey, computedOperator, filter);
      }
    }

    if (Array.isArray(filter)) {
      return and(filter.map((f) => filterToKysely(f, latestKey, latestOperator)({ eb, and, or, not })));
    }

    if (isObject(filter)) {
      const entries = Object.entries(filter);

      if (entries.length === 1) {
        const [key, value] = entries[0];
        if (Array.isArray(value)) {
          switch (key) {
            case '$all': {
              return and(value.map((v) => filterToKysely(v, latestKey, latestOperator)({ eb, and, or, not })));
            }
            case '$any': {
              const all = value.map((v) => filterToKysely(v, latestKey, latestOperator)({ eb, and, or, not }));
              return or(all);
            }
            case '$not': {
              const any = value.map((v) => not(filterToKysely(v, latestKey, latestOperator)({ eb, and, or, not })));
              return and(any);
            }
          }
        }
      }

      for (const [key, value] of entries) {
        return filterToKysely(
          value,
          key.startsWith('$') ? latestKey : key,
          key.startsWith('$') ? key : latestOperator
        )({ eb, and, or, not });
      }
    }

    throw new Error('Not implemented');
  };
};

/**
 * { "xata_id": { "$any": [1, 2, 3]} }
 * { "$any": [ { "xata_id": 1 }, { "xata_id": 2 } ] }
 * [ { "xata_id": 1 }, { "xata_id": 2 } ]
 */

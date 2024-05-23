import { BinaryOperatorExpression } from 'kysely/dist/cjs/parser/binary-operation-parser';
import { FilterColumnIncludes, FilterExpression, FilterPredicate, FilterPredicateOp } from '../api/schemas';
import { isDefined, isObject, isString } from '../util/lang';
import { SingleOrArray, Values } from '../util/types';
import { JSONValue } from './json';
import { ColumnsByValue, ValueAtColumn } from './selection';
import { ExpressionBuilder, ExpressionOrFactory, sql } from 'kysely';
import { ExpressionFactory, isExpressionOrFactory } from 'kysely/dist/cjs/parser/expression-parser';

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
  latestOperator?: FilterPredicate
): ((eb: ExpressionBuilder<any, any>) => ExpressionOrFactory<any, any, any>) | ExpressionFactory<any, any, any> => {
  return (eb) => {
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
      } else if (computedOperator === '$includesAny') {
        // TODO why does this have to be ANY to pass. should be all?
        return sql`(true = ANY(SELECT "tmp"=${filter} FROM unnest(${computedKey}) as tmp))`;
      } else if (computedOperator === '$startsWith') {
        return sql`(starts_with(${computedKey}, ${filter}))`;
      } else if (computedOperator === '$endsWith') {
        return sql`(${computedKey} LIKE ${eb.val('%' + buildPattern(filter, false))})`;
      } else if (computedOperator === '$lt') {
        return sql`${computedKey} < ${filter}`;
      } else if (computedOperator === '$lte') {
        return sql`${computedKey} <= ${filter}`;
      } else if (computedOperator === '$gt') {
        return sql`${computedKey} > ${filter}`;
      } else if (computedOperator === '$gte') {
        return sql`${computedKey} >= ${filter}`;
      } else if (computedOperator === '$is') {
        return sql`${computedKey} = ${filter}`;
      } else if (computedOperator === '$isNot') {
        return sql`${computedKey} != ${filter}`;
      } else if (computedOperator === '$pattern') {
        return sql`${computedKey} LIKE ${buildPattern(filter, true)}`;
      } else if (computedOperator === '$iPattern') {
        return sql`${computedKey} ILIKE ${buildPattern(filter, true)}`;
      } else if (computedOperator === '$exists') {
        return sql`(${eb.ref(filter as string)} IS NOT NULL)`;
      } else if (computedOperator === '$notExists') {
        return sql`(${eb.ref(filter as string)} IS NULL)`;
      } else {
        return eb(computedKey, '=', filter);
      }
    }

    if (Array.isArray(filter)) {
      return eb.and(filter.map((f) => filterToKysely(f, latestKey, latestOperator)(eb)));
    }

    if (isObject(filter)) {
      const entries = Object.entries(filter);

      if (entries.length === 1) {
        const [key, value] = entries[0];
        if (Array.isArray(value)) {
          switch (key) {
            case '$all': {
              return eb.and(value.map((v) => filterToKysely(v, latestKey, latestOperator)(eb)));
            }
            case '$any': {
              const all = value.map((v) => filterToKysely(v, latestKey, latestOperator)(eb));
              return eb.or(all);
            }
            case '$none':
            case '$not': {
              const any = value.map((v) => eb.not(filterToKysely(v, latestKey, latestOperator)(eb)));
              return eb.and(any);
            }
          }
        }
      }

      for (const [key, value] of entries) {
        return filterToKysely(
          value,
          key.startsWith('$') ? latestKey : key,
          key.startsWith('$') ? key : latestOperator
        )(eb);
      }
    }

    throw new Error('Not implemented');
  };
};

const buildPattern = (value: string | number | Date, translatePattern: boolean) => {
  // if there are special chars like %,_,*, ?, \,  in the value, we should escape them with single slash
  if (translatePattern) {
    return `${String(value)
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_')
      .replace('*', '%')
      .replace('?', '_')}`;
  }
  return `${String(value).replace('*', '%').replace('?', '_')}`;
};

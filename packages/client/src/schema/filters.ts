import { BinaryOperatorExpression } from 'kysely/dist/cjs/parser/binary-operation-parser';
import { FilterColumnIncludes, FilterExpression, FilterPredicate, FilterPredicateOp } from '../api/schemas';
import { isDefined, isObject, isString } from '../util/lang';
import { SingleOrArray, Values } from '../util/types';
import { JSONValue } from './json';
import { ColumnsByValue, ValueAtColumn } from './selection';
import { ExpressionBuilder, ExpressionOrFactory, JSONPathBuilder, ReferenceExpression, sql } from 'kysely';
import { ExpressionFactory, isExpressionOrFactory } from 'kysely/dist/cjs/parser/expression-parser';
import { Schemas } from '../api';

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

const isJsonColumnFilter = (key?: string): boolean => {
  if (!key) return false;
  return key?.includes('->') || key?.includes('->>');
};

const parseJsonPath = (path: string) => {
  const token = 'texttoremove';
  const pathToUse = path.replace(/->>/g, token).replace(/->/g, token).split(token);
  return {
    firstCol: pathToUse.shift(),
    pathToUse: pathToUse.map((i) => `'${i}'`).join(',')
  };
};

const buildStatement = ({
  computedOperator,
  computedKey,
  filter,
  eb,
  cast = true
}: {
  computedOperator?: FilterPredicate;
  computedKey: ReferenceExpression<any, any>;
  filter: string | number | Date;
  eb: ExpressionBuilder<any, any>;
  cast?: boolean;
}) => {
  switch (computedOperator) {
    case '$contains': {
      return sql`(position(${filter} IN ${computedKey}::text)>0)`;
    }
    case '$iContains': {
      return sql`(position(lower(${filter}) IN lower(${computedKey}::text))>0)`;
    }
    case '$includes': {
      return sql`(true = ANY(SELECT "tmp"=${filter} FROM unnest(${computedKey}) as tmp))`;
    }
    case '$includesNone': {
      return sql`(false = ALL(SELECT "tmp"=${filter} FROM unnest(${computedKey}) as tmp))`;
    }
    case '$includesAll': {
      return sql`(true = ANY(SELECT "tmp"=${filter} FROM unnest(${computedKey}) as tmp))`;
    }
    case '$includesAny': {
      return sql`(true = ANY(SELECT "tmp"=${filter} FROM unnest(${computedKey}) as tmp))`;
    }
    case '$startsWith': {
      return sql`(starts_with(${computedKey}::text, ${filter}))`;
    }
    case '$endsWith': {
      return sql`(${computedKey}::text LIKE ${eb.val('%' + buildPattern(filter, false))})`;
    }
    case '$lt': {
      return sql`${computedKey} < ${filter}`;
    }
    case '$lte': {
      return sql`${computedKey} <= ${filter}`;
    }
    case '$gt': {
      return sql`${computedKey} > ${filter}`;
    }
    case '$gte': {
      return sql`${computedKey} >= ${filter}`;
    }
    case '$is': {
      return sql`${computedKey} = ${filter}`;
    }
    case '$isNot': {
      return sql`${computedKey} != ${filter}`;
    }
    case '$pattern': {
      return sql`${computedKey} LIKE ${buildPattern(filter, true)}`;
    }
    case '$iPattern': {
      return sql`${computedKey} ILIKE ${buildPattern(filter, true)}`;
    }
    case '$exists': {
      return sql`(${eb.ref(filter as string)} IS NOT NULL)`;
    }
    case '$notExists': {
      return sql`(${eb.ref(filter as string)} IS NULL)`;
    }
    default: {
      if (cast) {
        return sql`CAST (${computedKey} AS text) = ${filter}`;
      }
      return eb(computedKey, '=', filter);
    }
  }
};

export const filterToKysely = (
  filter: Filter<any>,
  columnData: Schemas.Column[],
  latestKey?: string,
  latestOperator?: FilterPredicate
): ((eb: ExpressionBuilder<any, any>) => ExpressionOrFactory<any, any, any>) | ExpressionFactory<any, any, any> => {
  return (eb) => {
    if (isString(filter) || typeof filter === 'number' || filter instanceof Date) {
      const computedOperator = latestOperator ?? '=';
      const computedKey = eb.ref(latestKey ?? 'unknown');

      const isJsonColumnType = columnData.find((c) => c.name === latestKey)?.type === 'json';

      if (isJsonColumnFilter(latestKey)) {
        const { firstCol, pathToUse } = parseJsonPath(latestKey ?? '');
        return buildStatement({
          computedOperator,
          computedKey: sql.raw(`jsonb_extract_path_text(${firstCol}::jsonb, ${pathToUse})::text`),
          filter,
          eb,
          cast: false
        });
      }
      return buildStatement({
        computedOperator,
        computedKey,
        filter,
        eb,
        cast: isJsonColumnType ? false : true
      });
    }

    if (Array.isArray(filter)) {
      return eb.and(filter.map((f) => filterToKysely(f, columnData, latestKey, latestOperator)(eb)));
    }

    if (isObject(filter)) {
      const entries = Object.entries(filter);

      if (entries.length === 1) {
        const [key, value] = entries[0];
        const valueToUse = Array.isArray(value) ? value : [value];
        const stmt = valueToUse.map((v) =>
          filterToKysely(
            v,
            columnData,
            key.startsWith('$') ? latestKey : key,
            key.startsWith('$') ? key : latestOperator
          )(eb)
        );
        switch (key) {
          case '$all': {
            return eb.and(stmt);
          }
          case '$any': {
            return eb.or(stmt);
          }
          case '$includesNone': {
            return eb.and(
              valueToUse.map((v) =>
                eb.not(filterToKysely(v, columnData, key.startsWith('$') ? latestKey : key, '$includes')(eb))
              )
            );
          }
          case '$none':
          case '$not': {
            return eb.and(
              valueToUse.map((v) =>
                eb.not(filterToKysely(v, columnData, key.startsWith('$') ? latestKey : key, '$not')(eb))
              )
            );
          }
          default:
            return filterToKysely(
              value,
              columnData,
              key.startsWith('$') ? latestKey : key,
              key.startsWith('$') ? key : latestOperator
            )(eb);
        }
      } else {
        const stmt = entries.map(([key, value]) =>
          filterToKysely(
            value,
            columnData,
            key.startsWith('$') ? latestKey : key,
            key.startsWith('$') ? key : latestOperator
          )(eb)
        );
        switch (latestOperator) {
          case '$all': {
            return eb.and(stmt);
          }
          case '$any': {
            return eb.or(stmt);
          }
          case '$includesNone': {
            return eb.and(
              entries.map(([key, value]) =>
                eb.not(filterToKysely(value, columnData, key.startsWith('$') ? latestKey : key, '$includes')(eb))
              )
            );
          }
          case '$none':
          case '$not': {
            return eb.and(
              entries.map(([key, value]) =>
                eb.not(filterToKysely(value, columnData, key.startsWith('$') ? latestKey : key, '$not')(eb))
              )
            );
          }
          default: {
            return eb.and(stmt);
          }
        }
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

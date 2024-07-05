import { FilterExpression, FilterPredicate } from '../api/schemas';
import { isDefined, isNumber, isObject, isString } from '../util/lang';
import { SingleOrArray, Values } from '../util/types';
import { JSONValue } from './json';
import { ColumnsByValue, ValueAtColumn } from './selection';
import { ExpressionBuilder, ExpressionOrFactory, ReferenceExpression, sql } from 'kysely';
import { ExpressionFactory } from 'kysely/dist/cjs/parser/expression-parser';
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

const isJsonColumnFilter = (key?: string): boolean => (key && key?.includes('->') ? true : false);

const parseJsonPath = (path: string) => {
  const token = 'texttoremove';
  const pathToUse = path.replace(/->/g, token).split(token);
  return {
    firstCol: pathToUse.shift(),
    pathToUse: pathToUse.map((i) => `'${i}'`).join(',')
  };
};

const buildStatement = ({
  column,
  value,
  eb,
  operator,
  castToText = true
}: {
  column: ReferenceExpression<any, any>;
  value: string | number | Date;
  eb: ExpressionBuilder<any, any>;
  operator?: FilterPredicate;
  castToText?: boolean;
}) => {
  switch (operator) {
    case '$contains': {
      return sql`(position(${value} IN ${column}::text)>0)`;
    }
    case '$iContains': {
      return sql`(position(lower(${value}) IN lower(${column}::text))>0)`;
    }
    case '$includes': {
      return sql`(true = ANY(SELECT "tmp"=${value} FROM unnest(${column}) as tmp))`;
    }
    case '$includesNone': {
      return sql`(false = ALL(SELECT "tmp"=${value} FROM unnest(${column}) as tmp))`;
    }
    case '$includesAll': {
      return sql`(true = ANY(SELECT "tmp"=${value} FROM unnest(${column}) as tmp))`;
    }
    case '$includesAny': {
      return sql`(true = ANY(SELECT "tmp"=${value} FROM unnest(${column}) as tmp))`;
    }
    case '$startsWith': {
      return sql`(starts_with(${column}::text, ${value}))`;
    }
    case '$endsWith': {
      return sql`(${column}::text LIKE ${eb.val('%' + buildPattern(value, false))})`;
    }
    case '$lt': {
      return sql`${column} < ${value}`;
    }
    case '$lte': {
      return sql`${column} <= ${value}`;
    }
    case '$gt': {
      return sql`${column} > ${value}`;
    }
    case '$gte': {
      return sql`${column} >= ${value}`;
    }
    case '$is': {
      return sql`${column} = ${value}`;
    }
    case '$isNot': {
      return sql`${column} != ${value}`;
    }
    case '$pattern': {
      return sql`${column} LIKE ${buildPattern(value, true)}`;
    }
    case '$iPattern': {
      return sql`${column} ILIKE ${buildPattern(value, true)}`;
    }
    case '$exists': {
      return sql`(${eb.ref(value as string)} IS NOT NULL)`;
    }
    case '$notExists': {
      return sql`(${eb.ref(value as string)} IS NULL)`;
    }
    default: {
      if (castToText) {
        return sql`CAST (${column} AS text) = ${value}`;
      }
      return eb(column, '=', value);
    }
  }
};

export const filterToKysely = ({
  value,
  columnName,
  operation,
  path = []
}: {
  value: Filter<any>;
  columnName?: string;
  operation?: FilterPredicate;
  path: string[];
}):
  | ((
      eb: ExpressionBuilder<any, any>,
      columnData: Schemas.Column[],
      tableName?: string
    ) => ExpressionOrFactory<any, any, any>)
  | ExpressionFactory<any, any, any> => {
  return (eb, columnData, tableName) => {
    if (isString(value) || typeof value === 'number' || value instanceof Date) {
      const operator = operation ?? '=';
      const column = eb.ref(columnName ?? 'unknown');

      const isJsonColumnType = columnData.find((c) => c.name === columnName)?.type === 'json';
      const castToText = isJsonColumnType || value instanceof Date || isNumber(value) ? false : true;
      if (isJsonColumnFilter(columnName)) {
        const { firstCol, pathToUse } = parseJsonPath(columnName ?? '');
        return buildStatement({
          operator,
          column: sql.raw(`jsonb_extract_path_text(${firstCol}::jsonb, ${pathToUse})::text`),
          value,
          eb,
          castToText
        });
      }

      const buildS = buildStatement({
        operator,
        column,
        value,
        eb,
        castToText
      });
      return buildS;
    }

    if (Array.isArray(value)) {
      return eb.and(
        value.map((f) => {
          return filterToKysely({ value: f, columnName, operation, path: columnName ? [...path, columnName] : path })(
            eb,
            columnData,
            tableName
          );
        })
      );
    }
    if (isObject(value)) {
      const entries = Object.entries(value);

      const handleEntries = entries.map(([key, value]) => {
        const valueToUse = Array.isArray(value) ? value : [value];

        switch (key) {
          case '$all': {
            return eb.and(
              valueToUse.map((v) => {
                return filterToKysely({
                  value: v,
                  columnName: key.startsWith('$') ? columnName : key,
                  operation: key.startsWith('$') ? key : operation,
                  path: columnName ? [...path, columnName] : path
                })(eb, columnData, tableName);
              })
            );
          }
          case '$any': {
            return eb.or(
              valueToUse.map((v) => {
                return filterToKysely({
                  value: v,
                  columnName: key.startsWith('$') ? columnName : key,
                  operation: key.startsWith('$') ? key : operation,
                  path: columnName ? [...path, columnName] : path
                })(eb, columnData, tableName);
              })
            );
          }
          case '$includesNone': {
            return eb.and(
              valueToUse.map((v) =>
                eb.not(
                  filterToKysely({
                    value: v,
                    columnName: key.startsWith('$') ? columnName : key,
                    operation: '$includes',
                    path: columnName ? [...path, columnName] : path
                  })(eb, columnData, tableName)
                )
              )
            );
          }
          case '$none':
          case '$not': {
            return eb.and(
              valueToUse.map((v) =>
                eb.not(
                  filterToKysely({
                    value: v,
                    columnName: key.startsWith('$') ? columnName : key,
                    operation: '$not',
                    path: columnName ? [...path, columnName] : path
                  })(eb, columnData, tableName)
                )
              )
            );
          }

          default: {
            return eb.and(
              valueToUse.map((v) =>
                filterToKysely({
                  value: v,
                  columnName: key.startsWith('$') ? columnName : key,
                  operation: key.startsWith('$') ? key : operation,
                  path: key ? [...path, key] : path
                })(eb, columnData, tableName)
              )
            );
          }
        }
      });
      if (operation === '$any') {
        return eb.or(handleEntries);
      }
      return eb.and(handleEntries);
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

/**
 *
 * Separates the filter into relevant filters for regular fields and nested linked columns.
 * Removes nested filters for link fields to avoid duplicate conditions.
 * @param filter original filter
 * @param firstLevelOnly boolean to only return filters for non link/foreign key fields
 * @param linkFields a list of the tables linked fields to use for determining if a field is a link
 * @returns null or object
 */

export const relevantFilters = (filter: any, topLevelOnly: boolean, originalKey: string, visited: Set<string>) => {
  const copy = {};
  const traverse = (filter: any, path: string[]) => {
    for (const key in filter) {
      if (isObject(filter[key])) {
        if (topLevelOnly && !key.startsWith('$') && path?.length > 0 && !path[path.length - 1]?.startsWith('$')) {
          continue;
        }
        traverse(filter[key], [...path, key]);
      } else if (!topLevelOnly && path.includes(originalKey)) {
        path.push(key);
        const stringifiedPaths = path.join('.');
        if (visited.has(stringifiedPaths)) {
          continue;
        }
        visited.add(stringifiedPaths);
        atPath(copy, path)[key] = filter[key];
      } else if (topLevelOnly && !path.includes(originalKey)) {
        atPath(copy, path)[key] = filter[key];
      }
    }
  };

  traverse(filter, []);

  return Object.keys(copy).length > 0 ? copy : null;
};

export const atPath = (obj: object, atPath: string[]) => {
  return atPath.reduce((acc, key) => {
    if (!acc[key]) {
      acc[key] = {};
    }
    return acc[key];
  }, obj as { [k: string]: any });
};

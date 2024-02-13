import { isObject, isString } from '../util/lang';
import { If, IsArray, IsObject, StringKeys, UnionToIntersection, Values } from '../util/types';
import { XataArrayFile, XataFile, XataFileFields } from './files';
import { Link, XataRecord } from './record';

// Public: Utility type to get a union with the selectable columns of an object
export type SelectableColumn<O, RecursivePath extends any[] = []> =
  // Alias for any property
  | '*'
  // Properties of the current level
  | DataProps<O>
  // Nested properties of the lower levels
  | NestedColumns<O, RecursivePath>;

type ExpandedColumnNotation = {
  name: string;
  columns?: SelectableColumn<any>[];
  as?: string;
  limit?: number;
  offset?: number;
  order?: { column: string; order: 'asc' | 'desc' }[];
};

// Right now, we only support object notation in queryTable endpoint
// Once we support it in other endpoints, we can remove this and use SelectableColumn<O> instead
export type SelectableColumnWithObjectNotation<O, RecursivePath extends any[] = []> =
  | SelectableColumn<O, RecursivePath>
  | ExpandedColumnNotation;

export function isValidExpandedColumn(column: any): column is ExpandedColumnNotation {
  return isObject(column) && isString(column.name);
}

export function isValidSelectableColumns(columns: any): columns is SelectableColumn<any>[] {
  if (!Array.isArray(columns)) {
    return false;
  }

  return columns.every((column) => {
    if (typeof column === 'string') {
      return true;
    }

    if (typeof column === 'object') {
      return isValidExpandedColumn(column);
    }

    return false;
  });
}

type StringColumns<T> = T extends string ? T : never;
type ProjectionColumns<T> = T extends string
  ? never
  : T extends { as: infer As }
  ? NonNullable<As> extends string
    ? NonNullable<As>
    : never
  : never;

// Private: Returns columns ending with a wildcard
type WildcardColumns<O> = Values<{
  [K in SelectableColumn<O>]: K extends `${string}*` ? K : never;
}>;

// Public: Utility type to get a union with the selectable columns of an object by a given type
export type ColumnsByValue<O, Value> = Values<{
  [K in SelectableColumn<O>]: ValueAtColumn<O, K> extends infer C
    ? C extends Value
      ? K extends WildcardColumns<O>
        ? never
        : K
      : never
    : never;
}>;

// Public: Utility type to get the XataRecord built from a list of selected columns
export type SelectedPick<O extends XataRecord, Key extends SelectableColumnWithObjectNotation<O>[]> = XataRecord<O> &
  // For each column, we get its nested value and join it as an intersection
  UnionToIntersection<
    Values<{
      [K in StringColumns<Key[number]>]: NestedValueAtColumn<O, K> & XataRecord<O>;
    }>
  > &
  // For each column projection, we get its nested value and join it as an intersection
  // The typings here are a bit tricky, but it works, can definetely be improved
  UnionToIntersection<
    Values<{
      [K in ProjectionColumns<Key[number]>]: { [Key in K]: { records: (Record<string, any> & XataRecord<O>)[] } };
    }>
  >;

// Public: Utility type to get the value of a column at a given path
export type ValueAtColumn<Object, Key, RecursivePath extends any[] = []> = RecursivePath['length'] extends MAX_RECURSION
  ? never
  : Key extends '*'
  ? Values<Object> // Alias for any property
  : Key extends keyof Object
  ? Object[Key] // Properties of the current level
  : Key extends `${infer K}.${infer V}`
  ? K extends keyof Object
    ? Values<
        NonNullable<Object[K]> extends infer Item
          ? Item extends Record<string, any>
            ? V extends SelectableColumn<Item>
              ? { V: ValueAtColumn<Item, V, [...RecursivePath, Item]> }
              : never
            : Object[K]
          : never
      >
    : never
  : never;

// Private: To avoid circular dependencies, we limit the recursion depth
type MAX_RECURSION = 3;

// Private: Utility type to get a union with the columns below the current level
// Exclude type in union: never
type NestedColumns<O, RecursivePath extends any[]> = RecursivePath['length'] extends MAX_RECURSION
  ? never
  : If<
      IsObject<O>,
      Values<{
        [K in DataProps<O>]: NonNullable<O[K]> extends infer Item
          ? If<
              IsArray<Item>,
              Item extends (infer Type)[]
                ? Type extends XataArrayFile
                  ? K | `${K}.${keyof XataFileFields | '*'}`
                  : K | `${K}.${StringKeys<Type> | '*'}`
                : never,
              If<
                IsObject<Item>,
                Item extends XataRecord
                  ? SelectableColumn<Item, [...RecursivePath, Item]> extends infer Column
                    ? Column extends string
                      ? K | `${K}.${Column}`
                      : never
                    : never
                  : Item extends Date
                  ? K
                  : Item extends XataFile
                  ? K | `${K}.${keyof XataFileFields | '*'}` // This allows usage of objects that are not links
                  : `${K}.${StringKeys<Item> | '*'}`, // This allows usage of objects that are not links
                K
              >
            >
          : never;
      }>,
      never
    >;

// Private: Utility type to get object properties without XataRecord ones
type DataProps<O> = Exclude<StringKeys<O>, StringKeys<XataRecord>>;

// Private: Utility type to get the value of a column at a given path (nested object value)
// For "foo.bar.baz" we return { foo: { bar: { baz: type } } }
type NestedValueAtColumn<O, Key extends SelectableColumn<O>> =
  // If a column is a nested property, infer N and M
  Key extends `${infer N}.${infer M}`
    ? N extends DataProps<O>
      ? {
          [K in N]: M extends SelectableColumn<NonNullable<O[K]>>
            ? NonNullable<O[K]> extends XataFile
              ? ForwardNullable<O[K], XataFile>
              : NonNullable<O[K]> extends XataRecord
              ? ForwardNullable<O[K], NestedValueAtColumn<NonNullable<O[K]>, M> & XataRecord>
              : ForwardNullable<O[K], NestedValueAtColumn<NonNullable<O[K]>, M>>
            : NonNullable<O[K]> extends (infer ArrayType)[]
            ? ArrayType extends XataArrayFile
              ? ForwardNullable<O[K], XataArrayFile[]>
              : M extends SelectableColumn<NonNullable<ArrayType>>
              ? ForwardNullable<O[K], NestedValueAtColumn<NonNullable<ArrayType>, M>[]>
              : unknown //`Property ${M} is not selectable on type ${ArrayType}`
            : unknown; //`Property ${M} is not selectable on type ${K}`
        }
      : unknown //`Property ${N} is not a property of type ${O}`
    : Key extends DataProps<O>
    ? {
        [K in Key]: NonNullable<O[K]> extends XataRecord
          ? // If the property is a link, we forward the type of the internal XataRecord
            // Since it can be nullable, we use ForwardNullable to avoid loosing the internal type
            // Links that are not expanded ["link"] instead of ["link.*"] don't have the xata property
            ForwardNullable<O[K], SelectedPick<NonNullable<O[K]>, ['*']>>
          : O[K];
      }
    : Key extends '*'
    ? {
        [K in StringKeys<O>]: NonNullable<O[K]> extends XataRecord
          ? ForwardNullable<O[K], Link<NonNullable<O[K]>>> // Link forwards read/update method signatures to avoid loosing the internal type
          : O[K];
      }
    : unknown; //`Property ${Key} is invalid`;

type ForwardNullable<T, R> = T extends NonNullable<T> ? R : R | null;

import { If, IsArray, IsObject, StringKeys, UnionToIntersection, Values } from '../util/types';
import { Link, XataRecord } from './record';

// Public: Utility type to get a union with the selectable columns of an object
export type SelectableColumn<O, RecursivePath extends any[] = []> =
  // Alias for any property
  | '*'
  // Alias for id (not in schema)
  | 'id'
  // Properties of the current level
  | DataProps<O>
  // Nested properties of the lower levels
  | NestedColumns<O, RecursivePath>;

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
export type SelectedPick<O extends XataRecord, Key extends SelectableColumn<O>[]> = XataRecord<O> &
  // For each column, we get its nested value and join it as an intersection
  UnionToIntersection<
    Values<{
      [K in Key[number]]: NestedValueAtColumn<O, K> & XataRecord<O>;
    }>
  >;

// Public: Utility type to get the value of a column at a given path
export type ValueAtColumn<O, P extends SelectableColumn<O>> = P extends '*'
  ? Values<O> // Alias for any property
  : P extends 'id'
  ? string // Alias for id (not in schema)
  : P extends keyof O
  ? O[P] // Properties of the current level
  : P extends `${infer K}.${infer V}`
  ? K extends keyof O
    ? Values<
        NonNullable<O[K]> extends infer Item
          ? Item extends Record<string, any>
            ? V extends SelectableColumn<Item>
              ? { V: ValueAtColumn<Item, V> }
              : never
            : O[K]
          : never
      >
    : never
  : never;

// Private: To avoid circular dependencies, we limit the recursion depth
type MAX_RECURSION = 5;

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
              K, // If the property is an array, we stop recursion. We don't support object arrays yet
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
            ? NonNullable<O[K]> extends XataRecord
              ? ForwardNullable<O[K], NestedValueAtColumn<NonNullable<O[K]>, M> & XataRecord>
              : ForwardNullable<O[K], NestedValueAtColumn<NonNullable<O[K]>, M>>
            : unknown; //`Property ${M} is not selectable on type ${K}`
        }
      : unknown //`Property ${N} is not a property of type ${O}`
    : Key extends DataProps<O>
    ? {
        [K in Key]: NonNullable<O[K]> extends XataRecord
          ? ForwardNullable<O[K], SelectedPick<NonNullable<O[K]>, ['*']>>
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

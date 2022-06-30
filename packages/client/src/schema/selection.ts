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

// Public: Utility type to get the XataRecord built from a list of selected columns
export type SelectedPick<O extends XataRecord, Key extends SelectableColumn<O>[]> = XataRecord &
  // For each column, we get its nested value and join it as an intersection
  UnionToIntersection<
    Values<{
      [K in Key[number]]: NestedValueAtColumn<O, K> & XataRecord;
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
        RemoveNullable<O[K]> extends Record<string, any>
          ? V extends SelectableColumn<RemoveNullable<O[K]>>
            ? { V: ValueAtColumn<RemoveNullable<O[K]>, V> }
            : never
          : O[K]
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
        [K in DataProps<O>]: If<
          IsArray<RemoveNullable<O[K]>>,
          K, // If the property is an array, we stop recursion. We don't support object arrays yet
          If<
            IsObject<RemoveNullable<O[K]>>,
            RemoveNullable<O[K]> extends XataRecord
              ? SelectableColumn<RemoveNullable<O[K]>, [...RecursivePath, O[K]]> extends infer Column
                ? Column extends string
                  ? K | `${K}.${Column}`
                  : never
                : never
              : `${K}.${StringKeys<RemoveNullable<O[K]>> | '*'}`, // This allows usage of objects that are not links
            K
          >
        >;
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
          [K in N]: M extends SelectableColumn<RemoveNullable<O[K]>>
            ? RemoveNullable<O[K]> extends XataRecord
              ? ForwardNullable<O[K], NestedValueAtColumn<RemoveNullable<O[K]>, M> & XataRecord>
              : ForwardNullable<O[K], NestedValueAtColumn<RemoveNullable<O[K]>, M>>
            : unknown; //`Property ${M} is not selectable on type ${K}`
        }
      : unknown //`Property ${N} is not a property of type ${O}`
    : Key extends DataProps<O>
    ? {
        [K in Key]: RemoveNullable<O[K]> extends XataRecord
          ? ForwardNullable<O[K], SelectedPick<RemoveNullable<O[K]>, ['*']>>
          : O[K];
      }
    : Key extends '*'
    ? {
        [K in StringKeys<O>]: RemoveNullable<O[K]> extends XataRecord
          ? ForwardNullable<O[K], Link<RemoveNullable<O[K]>>> // Link forwards read/update method signatures to avoid loosing the internal type
          : O[K];
      }
    : unknown; //`Property ${Key} is invalid`;

type RemoveNullable<T> = T extends null | undefined ? never : T;
type ForwardNullable<T, R> = T extends RemoveNullable<T> ? R : R | null;

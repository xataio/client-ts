import { StringKeys, UnionToIntersection, Values } from '../util/types';
import { XataRecord } from './record';

export type SelectableColumn<O> = '*' | 'id' | Exclude<StringKeys<O>, keyof XataRecord> | NestedColumns<O>;

type NestedColumns<O> = O extends Record<string, any>
  ? Values<{
      [K in StringKeys<O>]: O[K] extends Array<unknown>
        ? `${K}` // We only support string multiple columns, no need to traverse array contents
        : O[K] extends Record<string, any>
        ? SelectableColumn<O[K]> extends ''
          ? `${K}`
          : SelectableColumn<O[K]> extends string
          ? `${K}.${SelectableColumn<O[K]>}`
          : never
        : K;
    }>
  : '';

export type SelectedDataPick<O, Key extends SelectableColumn<O>[]> = InternalSelectedPick<O, Key, false>;
export type SelectedRecordPick<O, Key extends SelectableColumn<O>[]> = InternalSelectedPick<O, Key, true>;

type InternalSelectedPick<O, Key extends SelectableColumn<O>[], IncludeXataRecord> = Key[number] extends '*'
  ? O
  : Pick<O, Extract<Key[number], keyof O>> &
      (IncludeXataRecord extends true ? XataRecord : unknown) &
      UnionToIntersection<
        Values<{
          [K in Exclude<Key[number], keyof O>]: K extends `${infer N}.${infer M}`
            ? N extends keyof O
              ? {
                  [key in N]: M extends '*'
                    ? O[N]
                    : M extends SelectableColumn<O[N]>
                    ? InternalSelectedPick<O[N], [M], IncludeXataRecord>
                    : never;
                }
              : never
            : never;
        }>
      >;

export type ValueAtColumn<O, P extends SelectableColumn<O>> = P extends '*'
  ? Values<O>
  : P extends 'id'
  ? string
  : P extends keyof O
  ? O[P]
  : P extends `${infer K}.${infer V}`
  ? K extends keyof O
    ? Values<V extends SelectableColumn<O[K]> ? { V: ValueAtColumn<O[K], V> } : never>
    : never
  : never;

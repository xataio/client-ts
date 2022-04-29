import { StringKeys, UnionToIntersection, Values } from '../util/types';
import { XataRecord } from './record';

export type SelectableColumn<O, RecursivePath extends any[] = []> =
  | '*'
  | 'id'
  | Exclude<StringKeys<O>, StringKeys<XataRecord>>
  | NestedColumns<O, RecursivePath>;

type MAX_RECURSION = 5;
type NestedColumns<O, RecursivePath extends any[]> = RecursivePath['length'] extends MAX_RECURSION
  ? never
  : O extends Record<string, any>
  ? Values<{
      [K in Exclude<StringKeys<O>, keyof XataRecord>]: NonNullable<O[K]> extends Array<unknown>
        ? `${K}` // We only support string multiple columns, no need to traverse array contents
        : NonNullable<O[K]> extends Record<string, any>
        ? SelectableColumn<NonNullable<O[K]>, [...RecursivePath, O[K]]> extends ''
          ? `${K}`
          : SelectableColumn<NonNullable<O[K]>, [...RecursivePath, O[K]]> extends string
          ? `${K}` | `${K}.${SelectableColumn<O[K], [...RecursivePath, O[K]]>}`
          : never
        : K;
    }>
  : never;

export type SelectedDataPick<O extends XataRecord, Key extends SelectableColumn<O>[]> = InternalSelectedPick<
  O,
  Key,
  false
>;
export type SelectedRecordPick<O extends XataRecord, Key extends SelectableColumn<O>[]> = InternalSelectedPick<
  O,
  Key,
  true
>;

type InternalSelectedPick<O extends XataRecord, Key extends SelectableColumn<O>[], IncludeRecord> = UnionToIntersection<
  Values<{
    [K in Key[number]]: NestedValueAtColumn<O, K, IncludeRecord> & ExtraProperties<O, IncludeRecord>;
  }>
>;

type ExtraProperties<O, IncludeRecord> = O extends XataRecord
  ? IncludeRecord extends true
    ? XataRecord
    : { id?: string }
  : unknown;

type NestedValueAtColumn<O, Key extends SelectableColumn<O>, IncludeRecord> = Key extends `${infer N}.${infer M}`
  ? N extends StringKeys<O>
    ? M extends SelectableColumn<O[N]>
      ? {
          // @ts-ignore: I can't get to type M properly, this should be correct...
          [key in N]: NestedValueAtColumn<NonNullable<O[N]>, M, IncludeRecord> &
            ExtraProperties<XataRecord, IncludeRecord>;
        }
      : `Property ${M} does not exist on type ${N}`
    : `Property ${N} does not exist on object`
  : Key extends StringKeys<O>
  ? { [key in Key]: O[Key] }
  : Key extends '*'
  ? {
      [K in IncludeRecord extends true
        ? keyof NonNullable<O>
        : Exclude<keyof NonNullable<O>, keyof XataRecord>]: NonNullable<NonNullable<O>[K]> extends XataRecord
        ? ExtraProperties<XataRecord, IncludeRecord>
        : NonNullable<O>[K];
    }
  : `Property ${Key} is invalid`;

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

import { XataRecord, SelectableColumn, ValueAtColumn } from '../schema';
import { ExclusiveOr, Values } from '../util/types';

type DateBooster = {
  /*
   * The datetime (formatted as RFC3339) from where to apply the score decay function. The maximum boost will be applied for records with values at this time.
   * If it is not specified, the current date and time is used.
   */
  origin?: string;
  /*
   * The duration at which distance from origin the score is decayed with factor, using an exponential function. It is fromatted as number + units, for example: `5d`, `20m`, `10s`.
   *
   * @pattern ^(\d+)(d|h|m|s|ms)$
   */
  scale: string;
  /*
   * The decay factor to expect at "scale" distance from the "origin".
   */
  decay: number;
};

type NumericBooster = {
  /*
   * The factor with which to multiply the value of the column before adding it to the item score.
   */
  factor: number;
};

type ValueBooster<T extends string | number | boolean> = {
  /*
   * The exact value to boost.
   */
  value: T;
  /*
   * The factor with which to multiply the score of the record.
   */
  factor: number;
};

export type Boosters<O extends XataRecord> = Values<{
  [K in SelectableColumn<O>]: NonNullable<ValueAtColumn<O, K>> extends Date
    ? { dateBooster: { column: K } & DateBooster }
    : NonNullable<ValueAtColumn<O, K>> extends number
    ? ExclusiveOr<
        { numericBooster?: { column: K } & NumericBooster },
        { valueBooster?: { column: K } & ValueBooster<number> }
      >
    : NonNullable<ValueAtColumn<O, K>> extends string | boolean
    ? { valueBooster: { column: K } & ValueBooster<NonNullable<ValueAtColumn<O, K>>> }
    : never;
}>;

import { SelectableColumn, ValueAtColumn } from '../schema';
import { Filter } from '../schema/filters';
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
  /**
   * The factor with which to multiply the added boost.
   *
   * @minimum 0
   */
  factor?: number;
};

type NumericBooster = {
  /*
   * The factor with which to multiply the value of the column before adding it to the item score.
   */
  factor: number;
  /**
   * Modifier to be applied to the column value, before being multiplied with the factor. The possible values are:
   *   - none (default).
   *   - log: common logarithm (base 10)
   *   - log1p: add 1 then take the common logarithm. This ensures that the value is positive if the
   *     value is between 0 and 1.
   *   - ln: natural logarithm (base e)
   *   - ln1p: add 1 then take the natural logarithm. This ensures that the value is positive if the
   *     value is between 0 and 1.
   *   - square: raise the value to the power of two.
   *   - sqrt: take the square root of the value.
   *   - reciprocal: reciprocate the value (if the value is `x`, the reciprocal is `1/x`).
   */
  modifier?: 'none' | 'log' | 'log1p' | 'ln' | 'ln1p' | 'square' | 'sqrt' | 'reciprocal';
};

type ValueBooster<T extends string | number | boolean> = {
  /*
   * The exact value to boost.
   */
  value: T;
  /*
   * The factor with which to multiply the added boost.
   */
  factor: number;
  /**
   * Modifier to be applied to the column value, before being multiplied with the factor. The possible values are:
   *   - none (default).
   *   - log: common logarithm (base 10)
   *   - log1p: add 1 then take the common logarithm. This ensures that the value is positive if the
   *     value is between 0 and 1.
   *   - ln: natural logarithm (base e)
   *   - ln1p: add 1 then take the natural logarithm. This ensures that the value is positive if the
   *     value is between 0 and 1.
   *   - square: raise the value to the power of two.
   *   - sqrt: take the square root of the value.
   *   - reciprocal: reciprocate the value (if the value is `x`, the reciprocal is `1/x`).
   */
  modifier?: 'none' | 'log' | 'log1p' | 'ln' | 'ln1p' | 'square' | 'sqrt' | 'reciprocal';
};

export type Boosters<O> = Values<{
  [K in SelectableColumn<O>]: NonNullable<ValueAtColumn<O, K>> extends Date
    ? {
        dateBooster: {
          column: K;
          /**
           * Only apply this booster to the records for which the provided filter matches.
           */
          ifMatchesFilter?: Filter<O>;
        } & DateBooster;
      }
    : NonNullable<ValueAtColumn<O, K>> extends number
    ? ExclusiveOr<
        {
          numericBooster?: {
            column: K;
            /**
             * Only apply this booster to the records for which the provided filter matches.
             */
            ifMatchesFilter?: Filter<O>;
          } & NumericBooster;
        },
        {
          valueBooster?: {
            column: K;
            /**
             * Only apply this booster to the records for which the provided filter matches.
             */
            ifMatchesFilter?: Filter<O>;
          } & ValueBooster<number>;
        }
      >
    : NonNullable<ValueAtColumn<O, K>> extends string | boolean
    ? {
        valueBooster: {
          column: K;
          /**
           * Only apply this booster to the records for which the provided filter matches.
           */
          ifMatchesFilter?: Filter<O>;
        } & ValueBooster<NonNullable<ValueAtColumn<O, K>>>;
      }
    : never;
}>;

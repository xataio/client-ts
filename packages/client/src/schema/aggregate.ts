import { Dictionary, ExactlyOne } from '../util/types';
import { Filter } from './filters';
import { XataRecord } from './record';
import { ColumnsByValue } from './selection';

/**
 * The description of a single aggregation operation. The key represents the
 */
export type AggregationExpression<O extends XataRecord> = ExactlyOne<{
  count: CountAggregation<O>;
  sum: SumAggregation<O>;
  max: MaxAggregation<O>;
  min: MinAggregation<O>;
  average: AverageAggregation<O>;
  percentiles: PercentilesAggregation<O>;
  uniqueCount: UniqueCountAggregation<O>;
  dateHistogram: DateHistogramAggregation<O>;
  topValues: TopValuesAggregation<O>;
  numericHistogram: NumericHistogramAggregation<O>;
}>;

export type AggregationResult<
  Record extends XataRecord,
  Expression extends Dictionary<AggregationExpression<Record>>
> = {
  aggs: {
    [K in keyof Expression]: AggregationResultItem<Record, Expression[K]>;
  };
};

type AggregationExpressionType<T extends AggregationExpression<any>> = keyof T;

type AggregationResultItem<
  Record extends XataRecord,
  Expression extends AggregationExpression<Record>
> = AggregationExpressionType<Expression> extends infer Type
  ? Type extends keyof AggregationExpressionResultTypes
    ? AggregationExpressionResultTypes[Type]
    : never
  : never;

/**
 * Count the number of records with an optional filter.
 */
export type CountAggregation<O extends XataRecord> =
  | {
      filter?: Filter<O>;
    }
  | '*';

/**
 * The sum of the numeric values in a particular column.
 */
export type SumAggregation<O extends XataRecord> = {
  /**
   * The column on which to compute the sum. Must be a numeric type.
   */
  column: ColumnsByValue<O, number>;
};

/**
 * The max of the numeric values in a particular column.
 */
export type MaxAggregation<O extends XataRecord> = {
  /**
   * The column on which to compute the max. Must be a numeric type.
   */
  column: ColumnsByValue<O, number>;
};

/**
 * The min of the numeric values in a particular column.
 */
export type MinAggregation<O extends XataRecord> = {
  /**
   * The column on which to compute the min. Must be a numeric type.
   */
  column: ColumnsByValue<O, number>;
};

/**
 * The average of the numeric values in a particular column.
 */
export type AverageAggregation<O extends XataRecord> = {
  /**
   * The column on which to compute the average. Must be a numeric type.
   */
  column: ColumnsByValue<O, number>;
};

/**
 * Calculate given percentiles of the numeric values in a particular column.
 */
export type PercentilesAggregation<O extends XataRecord> = {
  /**
   * The column on which to compute the average. Must be a numeric type.
   */
  column: ColumnsByValue<O, number>;
  percentiles: number[];
};

/**
 * Count the number of distinct values in a particular column.
 */
export type UniqueCountAggregation<O extends XataRecord> = {
  /**
   * The column from where to count the unique values.
   */
  column: ColumnsByValue<O, any>;
  /**
   * The threshold under which the unique count is exact. If the number of unique
   * values in the column is higher than this threshold, the results are approximative.
   * Maximum value is 40,000, default value is 3000.
   */
  precisionThreshold?: number;
};

/**
 * Split data into buckets by a datetime column. Accepts sub-aggregations for each bucket.
 */
export type DateHistogramAggregation<O extends XataRecord> = {
  /**
   * The column to use for bucketing. Must be of type datetime.
   */
  column: ColumnsByValue<O, Date>;
  /**
   * The fixed interval to use when bucketing.
   * It is fromatted as number + units, for example: `5d`, `20m`, `10s`.
   *
   * @pattern ^(\d+)(d|h|m|s|ms)$
   */
  interval?: string;
  /**
   * The calendar-aware interval to use when bucketing. Possible values are: `minute`,
   * `hour`, `day`, `week`, `month`, `quarter`, `year`.
   */
  calendarInterval?: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
  /**
   * The timezone to use for bucketing. By default, UTC is assumed.
   * The accepted format is as an ISO 8601 UTC offset. For example: `+01:00` or
   * `-08:00`.
   *
   * @pattern ^[+-][01]\d:[0-5]\d$
   */
  timezone?: string;
  aggs?: Dictionary<AggregationExpression<O>>;
};

/**
 * Split data into buckets by the unique values in a column. Accepts sub-aggregations for each bucket.
 * The top values as ordered by the number of records (`$count``) are returned.
 */
export type TopValuesAggregation<O extends XataRecord> = {
  /**
   * The column to use for bucketing. Accepted types are `string`, `email`, `int`, `float`, or `bool`.
   */
  column: ColumnsByValue<O, string | number | boolean>;
  aggs?: Dictionary<AggregationExpression<O>>;
  /**
   * The maximum number of unique values to return.
   *
   * @default 10
   * @maximum 1000
   */
  size?: number;
};

/**
 * Split data into buckets by dynamic numeric ranges. Accepts sub-aggregations for each bucket.
 */
export type NumericHistogramAggregation<O extends XataRecord> = {
  /**
   * The column to use for bucketing. Must be of numeric type.
   */
  column: ColumnsByValue<O, number>;
  /**
   * The numeric interval to use for bucketing. The resulting buckets will be ranges
   * with this value as size.
   *
   * @minimum 0
   */
  interval: number;
  /**
   * By default the bucket keys start with 0 and then continue in `interval` steps. The bucket
   * boundaries can be shiftend by using the offset option. For example, if the `interval` is 100,
   * but you prefer the bucket boundaries to be `[50, 150), [150, 250), etc.`, you can set `offset`
   * to 50.
   *
   * @default 0
   */
  offset?: number;
  aggs?: Dictionary<AggregationExpression<O>>;
};

type AggregationExpressionResultTypes = {
  count: number;
  sum: number | null;
  max: number | null;
  min: number | null;
  average: number | null;
  percentiles: { values: { [key: string]: number } };
  uniqueCount: number;
  dateHistogram: ComplexAggregationResult;
  topValues: ComplexAggregationResult;
  numericHistogram: ComplexAggregationResult;
};

type ComplexAggregationResult = {
  values: Array<{
    $key: string | number;
    $count: number;
    // TODO: Improve this type
    [key: string]: any;
  }>;
};

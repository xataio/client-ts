/**
 * Generated by @openapi-codegen
 *
 * @version 1.0
 */
/**
 * @maxLength 255
 * @minLength 1
 * @pattern [a-zA-Z0-9_\-~]+
 */
export type DBName = string;

/**
 * @format date-time
 * @x-go-type string
 */
export type DateTime = string;

export type Branch = {
  name: string;
  createdAt: DateTime;
};

export type ListBranchesResponse = {
  databaseName: string;
  branches: Branch[];
};

/**
 * The DBBranchName matches the pattern `{db_name}:{branch_name}`.
 *
 * @maxLength 511
 * @minLength 1
 * @pattern [a-zA-Z0-9_\-~]+:[a-zA-Z0-9_\-~]+
 */
export type DBBranchName = string;

/**
 * @maxLength 255
 * @minLength 1
 * @pattern [a-zA-Z0-9_\-~]+
 */
export type BranchName = string;

/**
 * @example {"repository":"github.com/my/repository","branch":"feature-login","stage":"testing","labels":["epic-100"]}
 * @x-go-type xata.BranchMetadata
 */
export type BranchMetadata = {
  /**
   * @minLength 1
   */
  repository?: string;
  branch?: BranchName;
  /**
   * @minLength 1
   */
  stage?: string;
  labels?: string[];
};

export type StartedFromMetadata = {
  branchName: BranchName;
  dbBranchID: string;
  migrationID: string;
};

/**
 * @maxLength 255
 * @minLength 1
 * @pattern [a-zA-Z0-9_\-~]+
 */
export type TableName = string;

export type ColumnLink = {
  table: string;
};

export type ColumnVector = {
  /**
   * @maximum 10000
   * @minimum 2
   */
  dimension: number;
};

export type Column = {
  name: string;
  type:
    | 'bool'
    | 'int'
    | 'float'
    | 'string'
    | 'text'
    | 'email'
    | 'multiple'
    | 'link'
    | 'object'
    | 'datetime'
    | 'vector'
    | 'fileArray';
  link?: ColumnLink;
  vector?: ColumnVector;
  notNull?: boolean;
  defaultValue?: string;
  unique?: boolean;
  columns?: Column[];
};

export type RevLink = {
  linkID: string;
  table: string;
};

export type Table = {
  id?: string;
  name: TableName;
  columns: Column[];
  revLinks?: RevLink[];
};

/**
 * @x-go-type xata.Schema
 */
export type Schema = {
  tables: Table[];
  tablesOrder?: string[];
};

export type DBBranch = {
  databaseName: DBName;
  branchName: BranchName;
  createdAt: DateTime;
  id: string;
  version: number;
  lastMigrationID: string;
  metadata?: BranchMetadata;
  startedFrom?: StartedFromMetadata;
  schema: Schema;
};

export type MigrationStatus = 'completed' | 'pending' | 'failed';

export type MetricsDatapoint = {
  timestamp: string;
  value: number;
};

export type MetricsLatency = {
  p50?: MetricsDatapoint[];
  p90?: MetricsDatapoint[];
};

export type ListGitBranchesResponse = {
  mapping: {
    gitBranch: string;
    xataBranch: string;
  }[];
};

export type ColumnMigration = {
  old: Column;
  ['new']: Column;
};

export type TableMigration = {
  newColumns?: {
    [key: string]: Column;
  };
  removedColumns?: string[];
  modifiedColumns?: ColumnMigration[];
  newColumnOrder: string[];
};

/**
 * @example {"newName":"newName","oldName":"oldName"}
 */
export type TableRename = {
  /**
   * @minLength 1
   */
  newName: string;
  /**
   * @minLength 1
   */
  oldName: string;
};

export type BranchMigration = {
  id?: string;
  parentID?: string;
  status: string;
  title?: string;
  lastGitRevision?: string;
  localChanges: boolean;
  createdAt?: DateTime;
  newTables?: {
    [key: string]: Table;
  };
  removedTables?: string[];
  tableMigrations?: {
    [key: string]: TableMigration;
  };
  newTableOrder: string[];
  renamedTables?: TableRename[];
};

/**
 * @minProperties 1
 */
export type FilterExpression = {
  $exists?: string;
  $existsNot?: string;
  $any?: FilterList;
  $all?: FilterList;
  $none?: FilterList;
  $not?: FilterList;
} & {
  [key: string]: FilterColumn;
};

export type FilterList = FilterExpression | FilterExpression[];

export type FilterValue = number | string | boolean;

export type FilterPredicate = FilterValue | FilterPredicate[] | FilterPredicateOp | FilterPredicateRangeOp;

export type FilterRangeValue = number | string;

/**
 * @maxProperties 1
 * @minProperties 1
 */
export type FilterPredicateOp = {
  $any?: FilterPredicate[];
  $all?: FilterPredicate[];
  $none?: FilterPredicate | FilterPredicate[];
  $not?: FilterPredicate | FilterPredicate[];
  $is?: FilterValue | FilterValue[];
  $isNot?: FilterValue | FilterValue[];
  $lt?: FilterRangeValue;
  $le?: FilterRangeValue;
  $gt?: FilterRangeValue;
  $ge?: FilterRangeValue;
  $contains?: string;
  $startsWith?: string;
  $endsWith?: string;
  $pattern?: string;
};

/**
 * @maxProperties 2
 * @minProperties 2
 */
export type FilterPredicateRangeOp = {
  $lt?: FilterRangeValue;
  $le?: FilterRangeValue;
  $gt?: FilterRangeValue;
  $ge?: FilterRangeValue;
};

/**
 * @maxProperties 1
 * @minProperties 1
 */
export type FilterColumnIncludes = {
  $includes?: FilterPredicate;
  $includesAny?: FilterPredicate;
  $includesAll?: FilterPredicate;
  $includesNone?: FilterPredicate;
};

export type FilterColumn = FilterColumnIncludes | FilterPredicate | FilterList;

export type SortOrder = 'asc' | 'desc';

export type SortExpression =
  | string[]
  | {
      [key: string]: SortOrder;
    }
  | {
      [key: string]: SortOrder;
    }[];

/**
 * Pagination settings.
 */
export type PageConfig = {
  /**
   * Query the next page that follow the cursor.
   */
  after?: string;
  /**
   * Query the previous page before the cursor.
   */
  before?: string;
  /**
   * Query the first page from the cursor.
   */
  start?: string;
  /**
   * Query the last page from the cursor.
   */
  end?: string;
  /**
   * Set page size. If the size is missing it is read from the cursor. If no cursor is given Xata will choose the default page size.
   *
   * @default 20
   */
  size?: number;
  /**
   * Use offset to skip entries. To skip pages set offset to a multiple of size.
   *
   * @default 0
   */
  offset?: number;
};

/**
 * @example name
 * @example email
 * @example created_at
 */
export type ColumnsProjection = string[];

/**
 * The migration request number.
 *
 * @minimum 0
 * @x-go-type migration.RequestNumber
 */
export type MigrationRequestNumber = number;

export type MigrationRequest = {
  number?: MigrationRequestNumber;
  /**
   * Migration request creation timestamp.
   */
  createdAt?: DateTime;
  /**
   * Last modified timestamp.
   */
  modifiedAt?: DateTime;
  /**
   * Timestamp when the migration request was closed.
   */
  closedAt?: DateTime;
  /**
   * Timestamp when the migration request was merged.
   */
  mergedAt?: DateTime;
  status?: 'open' | 'closed' | 'merging' | 'merged' | 'failed';
  /**
   * The migration request title.
   */
  title?: string;
  /**
   * The migration request body with detailed description.
   */
  body?: string;
  /**
   * Name of the source branch.
   */
  source?: string;
  /**
   * Name of the target branch.
   */
  target?: string;
};

/**
 * Records metadata
 */
export type RecordsMetadata = {
  page: {
    /**
     * last record id
     */
    cursor: string;
    /**
     * true if more records can be fetch
     */
    more: boolean;
  };
};

export type TableOpAdd = {
  table: string;
};

export type TableOpRemove = {
  table: string;
};

export type TableOpRename = {
  oldName: string;
  newName: string;
};

export type MigrationTableOp =
  | {
      addTable: TableOpAdd;
    }
  | {
      removeTable: TableOpRemove;
    }
  | {
      renameTable: TableOpRename;
    };

export type ColumnOpAdd = {
  table: string;
  column: Column;
};

export type ColumnOpRemove = {
  table: string;
  column: string;
};

export type ColumnOpRename = {
  table: string;
  oldName: string;
  newName: string;
};

export type MigrationColumnOp =
  | {
      addColumn: ColumnOpAdd;
    }
  | {
      removeColumn: ColumnOpRemove;
    }
  | {
      renameColumn: ColumnOpRename;
    };

/**
 * Branch schema migration operations.
 */
export type MigrationOp = MigrationTableOp | MigrationColumnOp;

export type Commit = {
  title?: string;
  message?: string;
  id: string;
  parentID?: string;
  mergeParentID?: string;
  status: MigrationStatus;
  createdAt: DateTime;
  modifiedAt?: DateTime;
  operations: MigrationOp[];
};

export type SchemaEditScript = {
  sourceMigrationID?: string;
  targetMigrationID?: string;
  operations: MigrationOp[];
};

/**
 * Branch schema migration.
 */
export type Migration = {
  parentID?: string;
  operations: MigrationOp[];
};

/**
 * @pattern [a-zA-Z0-9_\-~\.]+
 */
export type ColumnName = string;

/**
 * Insert operation
 */
export type TransactionInsertOp = {
  /**
   * The table name
   */
  table: string;
  /**
   * The record to insert. The `id` field is optional; when specified, it will be used as the ID for the record.
   */
  record: {
    [key: string]: any;
  };
  /**
   * The version of the record you expect to be overwriting. Only valid with an
   * explicit ID is also set in the `record` key.
   */
  ifVersion?: number;
  /**
   * createOnly is used to change how Xata acts when an explicit ID is set in the `record` key.
   *
   * If `createOnly` is set to `true`, Xata will only attempt to insert the record. If there's a conflict, Xata
   * will cancel the transaction.
   *
   * If `createOnly` is set to `false`, Xata will attempt to insert the record. If there's no
   * conflict, the record is inserted. If there is a conflict, Xata will replace the record.
   */
  createOnly?: boolean;
  /**
   * If set, the call will return the requested fields as part of the response.
   */
  columns?: string[];
};

/**
 * @maxLength 255
 * @minLength 1
 * @pattern [a-zA-Z0-9_-~:]+
 */
export type RecordID = string;

/**
 * Update operation
 */
export type TransactionUpdateOp = {
  /**
   * The table name
   */
  table: string;
  id: RecordID;
  /**
   * The fields of the record you'd like to update
   */
  fields: {
    [key: string]: any;
  };
  /**
   * The version of the record you expect to be updating
   */
  ifVersion?: number;
  /**
   * Xata will insert this record if it cannot be found.
   */
  upsert?: boolean;
  /**
   * If set, the call will return the requested fields as part of the response.
   */
  columns?: string[];
};

/**
 * A delete operation. The transaction will continue if no record matches the ID.
 */
export type TransactionDeleteOp = {
  /**
   * The table name
   */
  table: string;
  id: RecordID;
  /**
   * If set, the call will return the requested fields as part of the response.
   */
  columns?: string[];
};

/**
 * A transaction operation
 */
export type TransactionOperation =
  | {
      insert: TransactionInsertOp;
    }
  | {
      update: TransactionUpdateOp;
    }
  | {
      ['delete']: TransactionDeleteOp;
    };

/**
 * Fields to return in the transaction result.
 */
export type TransactionResultColumns = {
  [key: string]: any;
};

/**
 * A result from an insert operation.
 */
export type TransactionResultInsert = {
  /**
   * The type of operation who's result is being returned.
   */
  operation: 'insert';
  /**
   * The number of affected rows
   */
  rows: number;
  id: RecordID;
  columns?: TransactionResultColumns;
};

/**
 * A result from an update operation.
 */
export type TransactionResultUpdate = {
  /**
   * The type of operation who's result is being returned.
   */
  operation: 'update';
  /**
   * The number of updated rows
   */
  rows: number;
  id: RecordID;
  columns?: TransactionResultColumns;
};

/**
 * A result from a delete operation.
 */
export type TransactionResultDelete = {
  /**
   * The type of operation who's result is being returned.
   */
  operation: 'delete';
  /**
   * The number of deleted rows
   */
  rows: number;
  columns?: TransactionResultColumns;
};

/**
 * An ordered array of results from the submitted operations.
 */
export type TransactionSuccess = {
  results: (TransactionResultInsert | TransactionResultUpdate | TransactionResultDelete)[];
};

/**
 * An error message from a failing transaction operation
 */
export type TransactionError = {
  /**
   * The index of the failing operation
   */
  index: number;
  /**
   * The error message
   */
  message: string;
};

/**
 * An array of errors, with indicides, from the transaction.
 */
export type TransactionFailure = {
  /**
   * The request ID.
   */
  id: string;
  /**
   * An array of errors from the submitted operations.
   */
  errors: TransactionError[];
};

/**
 * Object column value
 */
export type ObjectValue = {
  [key: string]: string | boolean | number | string[] | number[] | DateTime | ObjectValue;
};

/**
 * Object representing a file
 *
 * @x-go-type file.InputFile
 */
export type InputFileEntry = {
  /**
   * File name
   *
   * @maxLength 1024
   * @minLength 1
   * @pattern [0-9a-zA-Z!\-_\.\*'\(\)]+
   */
  name: string;
  /**
   * Media type
   *
   * @maxLength 255
   * @minLength 3
   * @pattern ^\w+/[-+.\w]+$
   */
  mediaType?: string;
  /**
   * Base64 encoded content
   *
   * @maxLength 20971520
   */
  base64Content?: string;
  /**
   * Enable public access to the file
   */
  enablePublicUrl?: boolean;
  /**
   * Time to live for signed URLs
   */
  signedUrlTimeout?: number;
};

/**
 * Array of file entries
 *
 * @maxItems 50
 */
export type InputFileArray = InputFileEntry[];

/**
 * Xata input record
 */
export type DataInputRecord = {
  [key: string]:
    | RecordID
    | string
    | boolean
    | number
    | string[]
    | number[]
    | DateTime
    | ObjectValue
    | InputFileArray
    | InputFileEntry;
};

/**
 * Xata Table Record Metadata
 */
export type RecordMeta = {
  id: RecordID;
  xata: {
    /**
     * The record's version. Can be used for optimistic concurrency control.
     */
    version: number;
    /**
     * The record's table name. APIs that return records from multiple tables will set this field accordingly.
     */
    table?: string;
    /**
     * Highlights of the record. This is used by the search APIs to indicate which fields and parts of the fields have matched the search.
     */
    highlight?: {
      [key: string]:
        | string[]
        | {
            [key: string]: any;
          };
    };
    /**
     * The record's relevancy score. This is returned by the search APIs.
     */
    score?: number;
    /**
     * Encoding/Decoding errors
     */
    warnings?: string[];
  };
};

/**
 * The target expression is used to filter the search results by the target columns.
 */
export type TargetExpression = (
  | string
  | {
      /**
       * The name of the column.
       */
      column: string;
      /**
       * The weight of the column.
       *
       * @default 1
       * @maximum 10
       * @minimum 1
       */
      weight?: number;
    }
)[];

/**
 * Boost records with a particular value for a column.
 */
export type ValueBooster = {
  /**
   * The column in which to look for the value.
   */
  column: string;
  /**
   * The exact value to boost.
   */
  value: string | number | boolean;
  /**
   * The factor with which to multiply the score of the record.
   */
  factor: number;
  /**
   * Only apply this booster to the records for which the provided filter matches.
   */
  ifMatchesFilter?: FilterExpression;
};

/**
 * Boost records based on the value of a numeric column.
 */
export type NumericBooster = {
  /**
   * The column in which to look for the value.
   */
  column: string;
  /**
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
  /**
   * Only apply this booster to the records for which the provided filter matches.
   */
  ifMatchesFilter?: FilterExpression;
};

/**
 * Boost records based on the value of a datetime column. It is configured via "origin", "scale", and "decay". The further away from the "origin",
 * the more the score is decayed. The decay function uses an exponential function. For example if origin is "now", and scale is 10 days and decay is 0.5, it
 * should be interpreted as: a record with a date 10 days before/after origin will score 2 times less than a record with the date at origin.
 */
export type DateBooster = {
  /**
   * The column in which to look for the value.
   */
  column: string;
  /**
   * The datetime (formatted as RFC3339) from where to apply the score decay function. The maximum boost will be applied for records with values at this time.
   * If it is not specified, the current date and time is used.
   */
  origin?: string;
  /**
   * The duration at which distance from origin the score is decayed with factor, using an exponential function. It is fromatted as number + units, for example: `5d`, `20m`, `10s`.
   *
   * @pattern ^(\d+)(d|h|m|s|ms)$
   */
  scale: string;
  /**
   * The decay factor to expect at "scale" distance from the "origin".
   */
  decay: number;
  /**
   * Only apply this booster to the records for which the provided filter matches.
   */
  ifMatchesFilter?: FilterExpression;
};

/**
 * Booster Expression
 *
 * @x-go-type xata.BoosterExpression
 */
export type BoosterExpression =
  | {
      valueBooster?: ValueBooster;
    }
  | {
      numericBooster?: NumericBooster;
    }
  | {
      dateBooster?: DateBooster;
    };

/**
 * Maximum [Levenshtein distance](https://en.wikipedia.org/wiki/Levenshtein_distance) for the search terms. The Levenshtein
 * distance is the number of one character changes needed to make two strings equal. The default is 1, meaning that single
 * character typos per word are tollerated by search. You can set it to 0 to remove the typo tollerance or set it to 2
 * to allow two typos in a word.
 *
 * @default 1
 * @maximum 2
 * @minimum 0
 */
export type FuzzinessExpression = number;

/**
 * If the prefix type is set to "disabled" (the default), the search only matches full words. If the prefix type is set to "phrase", the search will return results that match prefixes of the search phrase.
 */
export type PrefixExpression = 'phrase' | 'disabled';

export type HighlightExpression = {
  /**
   * Set to `false` to disable highlighting. By default it is `true`.
   */
  enabled?: boolean;
  /**
   * Set to `false` to disable HTML encoding in highlight snippets. By default it is `true`.
   */
  encodeHTML?: boolean;
};

/**
 * Pagination settings for the search endpoints.
 */
export type SearchPageConfig = {
  /**
   * Set page size.
   *
   * @default 25
   * @maximum 200
   */
  size?: number;
  /**
   * Use offset to skip entries. To skip pages set offset to a multiple of size.
   *
   * @default 0
   * @maximum 800
   */
  offset?: number;
};

/**
 * A summary expression is the description of a single summary operation. It consists of a single
 * key representing the operation, and a value representing the column to be operated on.
 *
 * The column being summarized cannot be an internal column (id, xata.*), nor the base of
 * an object, i.e. if `settings` is an object with `dark_mode` as a field, you may summarize
 * `settings.dark_mode` but not `settings` nor `settings.*`.
 *
 * We currently support several aggregation functions. Not all functions can be run on all column
 * types.
 *
 *   - `count` is used to count the number of records in each group. Use `{"count": "*"}` to count
 *     all columns present, otherwise `{"count": "<column_path>"}` to count the number of non-null
 *     values are present at column path.
 *
 *     Count can be used on any column type, and always returns an int.
 *
 *   - `min` calculates the minimum value in each group. `min` is compatible with most types;
 *     string, multiple, text, email, int, float, and datetime. It returns a value of the same
 *     type as operated on. This means that `{"lowest_latency": {"min": "latency"}}` where
 *     `latency` is an int, will always return an int.
 *
 *   - `max` calculates the maximum value in each group. `max` shares the same compatibility as
 *     `min`.
 *
 *   - `sum` adds up all values in a group. `sum` can be run on `int` and `float` types, and will
 *     return a value of the same type as requested.
 *
 *   - `average` averages all values in a group. `average` can be run on `int` and `float` types, and
 *     always returns a float.
 *
 * @example {"count":"deleted_at"}
 * @x-go-type xbquery.Summary
 */
export type SummaryExpression = Record<string, any>;

/**
 * The description of the summaries you wish to receive. Set each key to be the field name
 * you'd like for the summary. These names must not collide with other columns you've
 * requested from `columns`; including implicit requests like `settings.*`.
 *
 * The value for each key needs to be an object. This object should contain one key and one
 * value only. In this object, the key should be set to the summary function you wish to use
 * and the value set to the column name to be summarized.
 *
 * The column being summarized cannot be an internal column (id, xata.*), nor the base of
 * an object, i.e. if `settings` is an object with `dark_mode` as a field, you may summarize
 * `settings.dark_mode` but not `settings` nor `settings.*`.
 *
 * @example {"all_users":{"count":"*"},"total_created":{"count":"created_at"},"min_cost":{"min":"cost"},"max_happiness":{"max":"happiness"},"total_revenue":{"sum":"revenue"},"average_speed":{"average":"speed"}}
 * @x-go-type xbquery.SummaryList
 */
export type SummaryExpressionList = {
  [key: string]: SummaryExpression;
};

/**
 * Count the number of records with an optional filter.
 */
export type CountAgg =
  | {
      filter?: FilterExpression;
    }
  | '*';

/**
 * The sum of the numeric values in a particular column.
 */
export type SumAgg = {
  /**
   * The column on which to compute the sum. Must be a numeric type.
   */
  column: string;
};

/**
 * The max of the numeric values in a particular column.
 */
export type MaxAgg = {
  /**
   * The column on which to compute the max. Must be a numeric type.
   */
  column: string;
};

/**
 * The min of the numeric values in a particular column.
 */
export type MinAgg = {
  /**
   * The column on which to compute the min. Must be a numeric type.
   */
  column: string;
};

/**
 * The average of the numeric values in a particular column.
 */
export type AverageAgg = {
  /**
   * The column on which to compute the average. Must be a numeric type.
   */
  column: string;
};

/**
 * Count the number of distinct values in a particular column.
 */
export type UniqueCountAgg = {
  /**
   * The column from where to count the unique values.
   */
  column: string;
  /**
   * The threshold under which the unique count is exact. If the number of unique
   * values in the column is higher than this threshold, the results are approximative.
   * Maximum value is 40,000, default value is 3000.
   */
  precisionThreshold?: number;
};

/**
 * The description of the aggregations you wish to receive.
 *
 * @example {"totalCount":{"count":"*"},"dailyActiveUsers":{"dateHistogram":{"column":"date","interval":"1d","aggs":{"uniqueUsers":{"uniqueCount":{"column":"userID"}}}}}}
 */
export type AggExpressionMap = {
  [key: string]: AggExpression;
};

/**
 * Split data into buckets by a datetime column. Accepts sub-aggregations for each bucket.
 */
export type DateHistogramAgg = {
  /**
   * The column to use for bucketing. Must be of type datetime.
   */
  column: string;
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
  aggs?: AggExpressionMap;
};

/**
 * Split data into buckets by the unique values in a column. Accepts sub-aggregations for each bucket.
 * The top values as ordered by the number of records (`$count`) are returned.
 */
export type TopValuesAgg = {
  /**
   * The column to use for bucketing. Accepted types are `string`, `email`, `int`, `float`, or `bool`.
   */
  column: string;
  aggs?: AggExpressionMap;
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
export type NumericHistogramAgg = {
  /**
   * The column to use for bucketing. Must be of numeric type.
   */
  column: string;
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
  aggs?: AggExpressionMap;
};

/**
 * The description of a single aggregation operation. It is an object with only one key-value pair.
 * The key represents the aggregation type, while the value is an object with the configuration of
 * the aggregation.
 *
 * @x-go-type xata.AggExpression
 */
export type AggExpression =
  | {
      count?: CountAgg;
    }
  | {
      sum?: SumAgg;
    }
  | {
      max?: MaxAgg;
    }
  | {
      min?: MinAgg;
    }
  | {
      average?: AverageAgg;
    }
  | {
      uniqueCount?: UniqueCountAgg;
    }
  | {
      dateHistogram?: DateHistogramAgg;
    }
  | {
      topValues?: TopValuesAgg;
    }
  | {
      numericHistogram?: NumericHistogramAgg;
    };

export type AggResponse =
  | (number | null)
  | {
      values: ({
        $key: string | number;
        $count: number;
      } & {
        [key: string]: AggResponse;
      })[];
    };

/**
 * Xata Table Record Metadata
 */
export type XataRecord = RecordMeta & {
  [key: string]: any;
};

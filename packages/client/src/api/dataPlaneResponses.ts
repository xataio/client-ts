/**
 * Generated by @openapi-codegen
 *
 * @version 1.0
 */
import type * as Schemas from './dataPlaneSchemas';

export type BadRequestError = {
  id?: string;
  message: string;
};

/**
 * @example {"message":"invalid API key"}
 */
export type AuthError = {
  id?: string;
  message: string;
};

export type SimpleError = {
  id?: string;
  message: string;
};

export type BranchMigrationPlan = {
  version: number;
  migration: Schemas.BranchMigration;
};

export type SchemaUpdateResponse = {
  /**
   * @minLength 1
   */
  migrationID: string;
  parentMigrationID: string;
  status: Schemas.MigrationStatus;
};

export type SchemaCompareResponse = {
  source: Schemas.Schema;
  target: Schemas.Schema;
  edits: Schemas.SchemaEditScript;
};

export type RecordUpdateResponse =
  | Schemas.XataRecord
  | {
      id: string;
      xata: {
        version: number;
      };
    };

export type PutFileResponse = Schemas.FileResponse;

export type RecordResponse = Schemas.XataRecord;

export type BulkInsertResponse =
  | {
      recordIDs: string[];
    }
  | {
      records: Schemas.XataRecord[];
    };

export type BulkError = {
  errors: {
    message?: string;
    status?: number;
  }[];
};

export type QueryResponse = {
  records: Schemas.XataRecord[];
  meta: Schemas.RecordsMetadata;
};

export type SearchResponse = {
  records: Schemas.XataRecord[];
  warning?: string;
};

export type SQLResponse = {
  records: Schemas.SQLRecord[];
  warning?: string;
};

export type RateLimitError = {
  id?: string;
  message: string;
};

export type SummarizeResponse = {
  summaries: Record<string, any>[];
};

/**
 * @example {"aggs":{"dailyUniqueUsers":{"values":[{"$count":321,"$key":"2022-02-22T22:22:22Z","uniqueUsers":134},{"$count":202,"$key":"2022-02-23T22:22:22Z","uniqueUsers":90}]}}}
 */
export type AggResponse = {
  aggs?: {
    [key: string]: Schemas.AggResponse;
  };
};

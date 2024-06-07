import { FuzzinessExpression, PrefixExpression } from '../api/dataPlaneSchemas';
import { Boosters } from '../search/boosters';
import { TargetColumn } from '../search/target';
import { Filter } from './filters';

export type KeywordAskOptions<Record> = {
  searchType?: 'keyword';
  search?: {
    fuzziness?: FuzzinessExpression;
    target?: TargetColumn<Record>[];
    prefix?: PrefixExpression;
    filter?: Filter<Record>;
    boosters?: Boosters<Record>[];
  };
};

export type VectorAskOptions<Record> = {
  searchType?: 'vector';
  vectorSearch?: {
    /**
     * The column to use for vector search. It must be of type `vector`.
     */
    column: string;
    /**
     * The column containing the text for vector search. Must be of type `text`.
     */
    contentColumn: string;
    filter?: Filter<Record>;
  };
};

type TypeAskOptions<Record> = KeywordAskOptions<Record> | VectorAskOptions<Record>;

type BaseAskOptions = {
  rules?: string[];
  sessionId?: string;
};

export type AskOptions<Record> = TypeAskOptions<Record> & BaseAskOptions;

export type AskResult = { answer?: string; records?: string[]; sessionId?: string };

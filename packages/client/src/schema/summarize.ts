import { Dictionary, ExactlyOne } from '../util/types';
import { XataRecord } from './record';
import { ColumnsByValue } from './selection';

export type SummarizeExpression<O extends XataRecord> = ExactlyOne<{
  count: ColumnsByValue<O, any>;
}>;

export type SummarizeResult<Record extends XataRecord, Expression extends Dictionary<SummarizeExpression<Record>>> = {
  summaries: {
    [K in keyof Expression]: SummarizeResultItem<Record, Expression[K]>;
  };
};

type SummarizeExpressionType<T extends SummarizeExpression<any>> = keyof T;

type SummarizeResultItem<
  Record extends XataRecord,
  Expression extends SummarizeExpression<Record>
> = SummarizeExpressionType<Expression> extends infer Type
  ? Type extends keyof SummarizeExpressionResultTypes
    ? SummarizeExpressionResultTypes[Type]
    : never
  : never;

type SummarizeExpressionResultTypes = {
  count: number;
};

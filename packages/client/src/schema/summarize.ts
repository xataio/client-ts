import { Dictionary, ExactlyOne, SingleOrArray, StringKeys } from '../util/types';
import { Filter } from './filters';
import { ColumnsByValue, SelectableColumn, SelectedPick, ValueAtColumn } from './selection';
import { SortFilter } from './sorting';

export type SummarizeExpression<ObjectType> = ExactlyOne<{
  count: ColumnsByValue<ObjectType, any> | '*';
  min: ColumnsByValue<ObjectType, string | number | Date | any[]>;
  max: ColumnsByValue<ObjectType, string | number | Date | any[]>;
  sum: ColumnsByValue<ObjectType, number>;
  average: ColumnsByValue<ObjectType, number>;
}>;

export type SummarizeParams<
  ObjectType,
  Expression extends Dictionary<SummarizeExpression<ObjectType>>,
  Columns extends SelectableColumn<ObjectType>[]
> = {
  summaries?: Expression;
  summariesFilter?: SummarizeFilter<ObjectType, Expression>;
  filter?: Filter<ObjectType>;
  columns?: Columns;
  sort?: SummarizeSort<ObjectType, Expression>;
  pagination?: { size: number };
  consistency?: 'strong' | 'eventual';
};

export type SummarizeResult<
  ObjectType,
  Expression extends Dictionary<SummarizeExpression<ObjectType>>,
  Columns extends SelectableColumn<ObjectType>[]
> = {
  summaries: SummarizeResultItem<ObjectType, Expression, Columns>[];
};

type SummarizeExpressionResultTypes<Value> = {
  count: number;
  min: Value;
  max: Value;
  sum: number;
  average: number;
};

type SummarizeSort<ObjectType, Expression extends Dictionary<SummarizeExpression<ObjectType>>> = SingleOrArray<
  SortFilter<ObjectType, ColumnsByValue<ObjectType, any> | StringKeys<Expression>>
>;

type SummarizeValuePick<O, Expression extends Dictionary<SummarizeExpression<O>>> = {
  [K in StringKeys<Expression>]: StringKeys<Expression[K]> extends infer SummarizeOperation
    ? SummarizeOperation extends keyof Expression[K]
      ? Expression[K][SummarizeOperation] extends infer Column
        ? Column extends SelectableColumn<O>
          ? SummarizeOperation extends keyof SummarizeExpressionResultTypes<any>
            ? SummarizeExpressionResultTypes<ValueAtColumn<O, Column>>[SummarizeOperation]
            : never
          : never
        : never
      : never
    : never;
};

type SummarizeFilter<ObjectType, Expression extends Dictionary<SummarizeExpression<ObjectType>>> = Filter<
  ObjectType & SummarizeValuePick<ObjectType, Expression>
>;

type SummarizeResultItem<
  ObjectType,
  Expression extends Dictionary<SummarizeExpression<ObjectType>>,
  Columns extends SelectableColumn<ObjectType>[]
> = SummarizeValuePick<ObjectType, Expression> & SelectedPick<ObjectType, Columns>;

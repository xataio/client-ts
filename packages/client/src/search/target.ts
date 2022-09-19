import { SelectableColumn, XataRecord } from '../schema';

export type TargetColumn<T extends XataRecord> =
  | SelectableColumn<T>
  | {
      /**
       * The name of the column.
       */
      column: SelectableColumn<T>;
      /**
       * The weight of the column.
       *
       * @default 1
       * @maximum 10
       * @minimum 1
       */
      weight?: number;
    };

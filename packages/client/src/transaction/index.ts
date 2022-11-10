import { branchTransaction } from '../api';
import { TransactionSuccess } from '../api/responses';
import { XataPlugin, XataPluginOptions } from '../plugins';
import { BaseData, XataRecord } from '../schema/record';
import { StringKeys } from '../util/types';

export type TransactionOperation<Schemas extends Record<string, BaseData>, Tables extends StringKeys<Schemas>> =
  | {
      insert: { table: Tables; record: Schemas[Tables]; ifVersion?: number; createOnly?: boolean };
    }
  | {
      update: { table: Tables; id: string; fields: Schemas[Tables]; ifVersion?: number; upsert?: boolean };
    }
  | {
      delete: { table: Tables; id: string };
    };

export type TransactionPluginResult<Schemas extends Record<string, BaseData>> = {
  run: <Tables extends StringKeys<Schemas>>(
    operations: TransactionOperation<Schemas, Tables>[]
  ) => Promise<TransactionSuccess>;
};

export class TransactionPlugin<Schemas extends Record<string, XataRecord>> extends XataPlugin {
  build({ getFetchProps }: XataPluginOptions): TransactionPluginResult<Schemas> {
    return {
      run: async <Tables extends StringKeys<Schemas>>(operations: TransactionOperation<Schemas, Tables>[]) => {
        const fetchProps = await getFetchProps();

        const response = await branchTransaction({
          pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}', region: '{region}' },
          body: { operations: operations as any },
          ...fetchProps
        });

        return response;
      }
    };
  }
}

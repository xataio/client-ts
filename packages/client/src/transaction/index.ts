import { branchTransaction } from '../api';
import { XataPlugin, XataPluginOptions } from '../plugins';
import { XataRecord } from '../schema/record';
import { Narrow, StringKeys } from '../util/types';
import { TransactionOperation, TransactionResults } from './operations';

export type TransactionPluginResult<Schemas extends Record<string, XataRecord>> = {
  run: <Tables extends StringKeys<Schemas>, Operations extends TransactionOperation<Schemas, Tables>[]>(
    operations: Narrow<Operations>
  ) => Promise<TransactionResults<Schemas, Tables, Operations>>;
};

export class TransactionPlugin<Schemas extends Record<string, XataRecord>> extends XataPlugin {
  build({ getFetchProps }: XataPluginOptions): TransactionPluginResult<Schemas> {
    return {
      run: async <Tables extends StringKeys<Schemas>, Operations extends TransactionOperation<Schemas, Tables>[]>(
        operations: Narrow<Operations>
      ) => {
        const fetchProps = await getFetchProps();

        const response = await branchTransaction({
          pathParams: { workspace: '{workspaceId}', dbBranchName: '{dbBranch}', region: '{region}' },
          body: { operations: operations as any },
          ...fetchProps
        });

        return response as any;
      }
    };
  }
}

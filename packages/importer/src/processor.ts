import { getBranchDetails, Schemas, XataPluginOptions } from '@xata.io/client';

export type CompareSchemaResult = {
  missingColumns: {
    column: string;
    type: string;
  }[];
  columnTypes: {
    columnName: string;
    schemaType: string;
    guessedType?: string;
    castedType?: string;
    error?: boolean;
  }[];
};

export type TableInfo = {
  workspace: string;
  region: string;
  database: string;
  branch: string;
  table: string;
};

export const findTable = async (
  tableInfo: TableInfo,
  xataPluginOptions: XataPluginOptions
): Promise<Schemas.Table | undefined> => {
  const { workspace, region, database, branch, table } = tableInfo;
  console.log('database', database);
  const dbBranchName = `${database}:${branch}`;
  console.log('xataPluginOptions', xataPluginOptions);
  const branchDetails = await getBranchDetails({
    // @ts-ignore
    pathParams: { workspace, dbBranchName, region, database },
    ...xataPluginOptions
  });
  console.log('did it');
  const { tables } = branchDetails.schema;
  console.log('tables', tables);

  return tables.find((t) => t.name === table);
};

// export const compareTables = (
//   columns: string[],
//   types: string[],
//   existingTable: Schemas.Table | undefined,
//   newTable: Schemas.Table | undefined
// ): CompareSchemaResult => {

//   existingTable?.columns
//   const result: CompareSchemaResult = {
//     missingColumns: [],
//     columnTypes: []
//   };

//   const schemaColumns = [{ name: 'id', type: 'string' }, ...table.columns];

//   columns.forEach((column, i) => {
//     const existing = schemaColumns.find((col) => col.name === column);
//     if (existing) {
//       const type = castType(existing.type, types[i]);
//       result.columnTypes.push({
//         columnName: column,
//         schemaType: existing.type,
//         guessedType: types[i],
//         castedType: type,
//         error: type !== existing.type
//       });
//     } else {
//       const type = types[i];
//       result.missingColumns.push({ column, type });
//       result.columnTypes.push({
//         columnName: column,
//         schemaType: type,
//         guessedType: types[i],
//         castedType: type,
//         error: false
//       });
//     }
//   });

//   return result;
// };

// export const updateSchema = async (tableInfo: TableInfo) => {
//   const { workspace, region, database, branch, table } = tableInfo;

//   if (changes.missingTable) {
//     await api.tables.createTable({ workspace, region, database, branch, table });
//   }

//   for (const column of changes.missingColumns) {
//     await api.tables.addTableColumn({
//       workspace,
//       region,
//       database,
//       branch,
//       table,
//       column: {
//         name: column.column,
//         type: column.type as Schemas.Column['type']
//       }
//     });
//   }
// };

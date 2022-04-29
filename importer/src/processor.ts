import { XataApiClient } from '@xata.io/client';
import { Table } from '@xata.io/client/dist/api/schemas';
import { ParseOptions } from './index.js';
import { castType, guessTypes, parseRow } from './utils.js';

export type CompareSchemaResult = {
  missingTable: boolean;
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
  workspaceID: string;
  database: string;
  branch: string;
  name: string;
};

type ProcessorOptions = Omit<ParseOptions, 'callback'> & {
  shouldContinue(compareSchemaResult: CompareSchemaResult): Promise<boolean>;
};

export function createProcessor(xata: XataApiClient, tableInfo: TableInfo, options: ProcessorOptions): ParseOptions {
  const { types, columns } = options;
  let first = true;

  if (types && columns && types.length !== columns.length) {
    throw new Error('Different number of column names and column types');
  }

  const callback: ParseOptions['callback'] = async (lines: string[][], columns?: string[]) => {
    const columnNames = options.columns || columns;
    if (!columnNames) {
      throw new Error(
        'Cannot calculate column names. A file header was not specified and no custom columns were specified either'
      );
    }
    if (first) {
      first = false;

      const columnTypes = types || guessTypes(lines, columnNames);
      const table = await findTable(xata, tableInfo);
      const compare = compareSquema(columnNames, columnTypes, table);
      const cont = await options.shouldContinue(compare);

      if (!cont) return true; // Stops the parsing

      await updateSchema(xata, tableInfo, compare);
    }

    const parsed = lines.map((row) => parseRow(row, types || []));

    await batchUpsnsert(xata, tableInfo, columnNames, parsed);
  };
  return { ...options, callback };
}

async function findTable(xata: XataApiClient, tableInfo: TableInfo) {
  const { workspaceID, database, branch, name } = tableInfo;
  const branchDetails = await xata.branches.getBranchDetails(workspaceID, database, branch);
  const { schema } = branchDetails;
  const { tables } = schema;

  return tables.find((t) => t.name === name);
}

export function compareSquema(columns: string[], types: string[], table: Table | undefined): CompareSchemaResult {
  if (!table) {
    return {
      missingTable: true,
      missingColumns: columns.map((column, i) => ({ column, type: types[i] })),
      columnTypes: types.map((type, i) => ({ columnName: columns[i], schemaType: type }))
    };
  }

  const result: CompareSchemaResult = {
    missingTable: false,
    missingColumns: [],
    columnTypes: []
  };

  columns.forEach((column, i) => {
    const existing = table.columns.find((col) => col.name === column);
    if (existing) {
      const type = castType(existing.type, types[i]);
      result.columnTypes.push({
        columnName: columns[i],
        schemaType: existing.type,
        guessedType: types[i],
        castedType: type,
        error: type !== existing.type
      });
    } else {
      const type = types[i];
      result.missingColumns.push({ column, type });
      result.columnTypes.push({
        columnName: columns[i],
        schemaType: type,
        guessedType: types[i],
        castedType: type,
        error: false
      });
    }
  });
  return result;
}

export async function updateSchema(xata: XataApiClient, tableInfo: TableInfo, changes: CompareSchemaResult) {
  console.log('update table', tableInfo, changes);
}

export async function batchUpsnsert(
  xata: XataApiClient,
  tableInfo: TableInfo,
  columns: string[],
  values: Array<ReturnType<typeof parseRow>>
) {
  console.log('insert', columns, values);
}

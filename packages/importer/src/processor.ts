import { Schemas, XataApiClient } from '@xata.io/client';
import { ParseOptions } from './index';
import { castType, guessTypes, normalizeColumnName, parseRow } from './utils';

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
  tableName: string;
};

type ProcessorOptions = Omit<ParseOptions, 'callback'> & {
  shouldContinue(compareSchemaResult: CompareSchemaResult): Promise<boolean>;
  onBatchProcessed?: (rows: number) => void;
};

export function createProcessor(xata: XataApiClient, tableInfo: TableInfo, options: ProcessorOptions): ParseOptions {
  let { types } = options;
  const { columns, onBatchProcessed } = options;
  let first = true;

  if (types && columns && types.length !== columns.length) {
    throw new Error('Different number of column names and column types');
  }

  const callback: ParseOptions['callback'] = async (
    lines: string[][],
    columns: string[] | undefined,
    count: number
  ) => {
    const columnNames = (options.columns || columns || []).map(normalizeColumnName);
    if (columnNames.length === 0) {
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

      if (cont === false) return true; // Stops the parsing

      await updateSchema(xata, tableInfo, compare);

      types = compare.columnTypes.map((type) => type.schemaType);
    }

    // TODO: values that do not match the type are transformed to null values. We should allow users to have control on that
    const parsed = lines.map((row) => parseRow(row, types || []));

    await batchUpsert(xata, tableInfo, columnNames, parsed);

    if (onBatchProcessed) onBatchProcessed(count);
  };
  return { ...options, callback };
}

export async function findTable(xata: XataApiClient, tableInfo: TableInfo): Promise<Schemas.Table | undefined> {
  const { workspaceID, database, branch, tableName: name } = tableInfo;
  const branchDetails = await xata.branches.getBranchDetails(workspaceID, database, branch);
  const { schema } = branchDetails;
  const { tables } = schema;

  return tables.find((t) => t.name === name);
}

export function compareSquema(
  columns: string[],
  types: string[],
  table: Schemas.Table | undefined
): CompareSchemaResult {
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
  const { workspaceID, database, branch, tableName } = tableInfo;

  if (changes.missingTable) {
    await xata.tables.createTable(workspaceID, database, branch, tableName);
  }

  for (const column of changes.missingColumns) {
    await xata.tables.addTableColumn(workspaceID, database, branch, tableName, {
      name: column.column,
      type: column.type as Schemas.Column['type']
    });
  }
}

export async function batchUpsert(
  xata: XataApiClient,
  tableInfo: TableInfo,
  columns: string[],
  values: Array<ReturnType<typeof parseRow>>
) {
  const { workspaceID, database, branch, tableName } = tableInfo;

  const records = values.map((row) => {
    const record: Record<string, unknown> = {};
    columns.forEach((column, i) => {
      record[column] = row[i];
    });
    return record;
  });

  await xata.records.bulkInsertTableRecords(workspaceID, database, branch, tableName, records);
}

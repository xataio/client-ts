import { ParseOptions } from './index.js';
import { parseArray } from './utils.js';
import { XataApiClient } from '@xata.io/client';
import { Table } from '@xata.io/client/dist/api/schemas';

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

export function guessTypes(lines: string[][], columns: string[]): string[] {
  const types: string[] = new Array(columns.length).fill(undefined);
  for (const line of lines) {
    for (let index = 0; index < columns.length; index++) {
      const type = types[index];
      const value = line[index];

      // In the future this can be used to specify if the column is nullable or not
      if (!value) continue;

      const valueType = guessType(value);
      if (!type) {
        types[index] = valueType;
      } else if (type !== valueType) {
        types[index] = castType(type, valueType);
      }
    }
  }
  // replace undefined types with strings. This can happen if a column is full of empty values
  return types.map((x) => x || 'string');
}

export function guessType(value: string) {
  const num = +value;
  if (Number.isSafeInteger(num)) {
    return 'int';
  } else if (Number.isFinite(num)) {
    return 'float';
  } else if (['true', 'false'].includes(value)) {
    return 'bool';
  } else if (value.match(/\S+@\S+.\S+/)) {
    return 'email';
  } else if (parseArray(value)) {
    return 'multiple';
  } else if (value.indexOf('\n') >= 0) {
    return 'text';
  }
  return 'string';
}

export function castType(a: string, b: string) {
  if ((a === 'float' && b === 'int') || (a === 'int' && b === 'float')) {
    return 'float';
  } else if (a === 'text' || b === 'text') {
    return 'text';
  }
  return 'string';
}

export function parseRow(values: string[], types: string[]) {
  return values.map((val, i) => {
    const type = types[i];
    if (type === 'int') {
      const num = +val;
      return Number.isSafeInteger(num) ? num : null;
    } else if (type === 'float') {
      const num = +val;
      return Number.isFinite(num) ? num : null;
    } else if (type === 'bool') {
      return ['true', 'false'].includes(val) ? Boolean(val) : null;
    } else if (type === 'multiple') {
      return parseArray(val);
    }
    return val;
  });
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

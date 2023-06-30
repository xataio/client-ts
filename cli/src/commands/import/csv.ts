import { Args } from '@oclif/core';
import { Schemas } from '@xata.io/client';
import { open } from 'fs/promises';
import { BaseCommand } from '../../base.js';
import { isFileEncoding } from '../../utils/files.js';
import { commonImportFlags, csvFlags } from '../../utils/importer.js';

export default class ImportCSV extends BaseCommand<typeof ImportCSV> {
  static description = 'Import a CSV file';

  static examples = [];

  static flags = {
    ...this.databaseURLFlag,
    ...commonImportFlags(),
    ...csvFlags('')
  };

  static args = {
    file: Args.string({ description: 'File to import', required: true })
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parseCommand();
    const {
      table,
      encoding,
      delimiter,
      header,
      skipEmptyLines,
      nullValues,
      quoteChar,
      escapeChar,
      newline,
      commentPrefix
    } = flags;

    let columns = flagsToColumns(flags);

    const csvOptions = {
      delimiter,
      header,
      skipEmptyLines,
      nullValues,
      quoteChar,
      escapeChar,
      newline: newline as any,
      commentPrefix,
      columns
    };

    if (!isFileEncoding(encoding)) {
      this.error(`Invalid encoding: ${encoding}`);
    }
    const getFileStream = async () => (await open(file, 'r')).createReadStream({ encoding });
    const { workspace, region, database, branch } = await this.getParsedDatabaseURLWithBranch(flags.db, flags.branch);
    const xata = await this.getXataClient();

    const { file } = args;

    const existingTable = await xata.import.findTable({ workspace, region, database, branch, table });
    if (existingTable) {
      throw new Error(`Table ${table} already exists. Only imports to new tables are supported`);
    }
    const parseStream = await getFileStream();
    const parseResults = (
      await xata.import.parseCsvStream({
        fileStream: parseStream,
        parserOptions: { ...csvOptions, limit: 1000 }
      })
    ).results;
    parseStream.close();
    if (!parseResults.success) {
      throw new Error(`Failed to parse CSV file ${parseResults.errors.join(' ')}`);
    }
    if (!columns) {
      columns = parseResults.columns;
    }

    // schema edit APIs?
    // compare branch with user schema
    // apply edits
    await xata.api.tables.createTable({ workspace, region, database, branch, table });

    for (const column of columns) {
      await xata.api.tables.addTableColumn({
        workspace,
        region,
        database,
        branch,
        table,
        column
      });
    }

    let importSuccessCount = 0;
    let importErrorCount = 0;
    const fileStream = await getFileStream();
    await xata.import.parseCsvStreamBatches({
      fileStream: fileStream,
      fileSizeBytes: (await (await open(file, 'r')).stat()).size,
      parserOptions: { ...csvOptions, columns },
      batchRowCount: 1000,
      onBatch: async (parseResults, meta) => {
        if (!parseResults.success) {
          throw new Error('Failed to parse CSV file');
        }
        const dbBranchName = `${database}:${branch}`;
        const importResult = await xata.import.importBatch(
          // @ts-ignore
          { dbBranchName: dbBranchName, region, workspace: workspace, database },
          { columns: parseResults.columns, table, batch: parseResults }
        );
        importSuccessCount += importResult.successful.results.length;
        if (importResult.errors) {
          importErrorCount += importResult.errors.length;
        }
        this.info(
          `${importSuccessCount} rows successfully imported ${importErrorCount} errors. ${Math.floor(
            meta.estimatedProgress * 100
          )}% complete`
        );
      }
    });
    fileStream.close();
    this.success('Completed');
    process.exit(0);
  }
}

const flagsToColumns = (flags: {
  types: string | undefined;
  columns: string | undefined;
}): Schemas.Column[] | undefined => {
  if (!flags.columns && !flags.types) return undefined;
  if (flags.columns && !flags.types) {
    throw new Error('Must specify types when specifying columns');
  }
  if (!flags.columns && flags.types) {
    throw new Error('Must specify columns when specifying types');
  }
  const columns = splitCommas(flags.columns);
  const types = splitCommas(flags.types);
  if (columns?.length !== types?.length) {
    throw new Error('Must specify same number of columns and types');
  }
  return columns.map((name, i) => {
    // probably should assert the type here :\
    const type = types[i] as Schemas.Column['type'];
    return { name, type };
  });
};

export function splitCommas(value: unknown): string[] {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((s) => s.trim());
}

import { Args, Flags } from '@oclif/core';
import { Schemas } from '@xata.io/client';
import { Column } from '@xata.io/codegen';
import { importColumnTypes } from '@xata.io/importer';
import { open, writeFile } from 'fs/promises';
import { BaseCommand } from '../../base.js';
import { enumFlag } from '../../utils/oclif.js';

const ERROR_CONSOLE_LOG_LIMIT = 200;
const ERROR_LOG_FILE = 'errors.log';

const bufferEncodings: BufferEncoding[] = [
  'ascii',
  'utf8',
  'utf16le',
  'ucs2',
  'ucs-2',
  'base64',
  'base64url',
  'latin1',
  'binary',
  'hex'
];

export default class ImportCSV extends BaseCommand<typeof ImportCSV> {
  static description = 'Import a CSV file';

  static examples = [
    'Import a CSV file using the column names of the CSV header',
    '$ xata import csv users.csv --table=users',
    'Specify the column names and types. They must follow the order they appear in the CSV file',
    '$ xata import csv users.csv --table=users --columns=name,email --types=string,email',
    'Create the table or any missing column if needed without asking',
    '$ xata import csv users.csv --table=users --columns=name,email --types=string,email --create'
  ];

  static flags = {
    ...this.databaseURLFlag,
    ...BaseCommand.forceFlag('Update the database schema if necessary without asking'),
    branch: this.branchFlag,
    table: Flags.string({
      description: 'The table where the CSV file will be imported to'
    }),
    types: Flags.string({
      description: 'Column types separated by commas'
    }),
    columns: Flags.string({
      description: 'Column names separated by commas'
    }),
    'no-header': Flags.boolean({
      description: 'Specify that the CSV file has no header'
    }),
    create: Flags.boolean({
      description: "Whether the table or columns should be created if they don't exist without asking"
    }),
    'batch-size': Flags.integer({
      description: 'Batch size to process and upload records'
    }),
    'max-rows': Flags.integer({
      description: 'Maximum number of rows to process'
    }),
    delimiter: Flags.string({
      description: 'Delimiter to use for splitting CSV data'
    }),
    'delimiters-to-guess': Flags.string({
      description: 'Delimiters to guess for splitting CSV data'
    }),
    'null-value': Flags.string({
      description: 'Value to use for null values',
      multiple: true
    }),
    encoding: enumFlag<BufferEncoding>({
      description: 'The encoding to use when reading the file',
      options: bufferEncodings
    })
  };

  static args = {
    file: Args.string({ description: 'The file to be imported', required: true })
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parseCommand();
    const { file } = args;
    const defaultTable = file
      .replace(/^.*[\\/]/, '')
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9-_~]/g, '');
    const {
      table = defaultTable,
      'no-header': noHeader,
      create,
      'batch-size': batchSize = 1000,
      'max-rows': limit,
      delimiter,
      'delimiters-to-guess': delimitersToGuess,
      'null-value': nullValues,
      encoding = 'utf8'
    } = flags;
    const header = !noHeader;
    const flagColumns = flagsToColumns(flags);

    const csvOptions = {
      delimiter,
      delimitersToGuess: delimitersToGuess ? splitCommas(delimitersToGuess) : undefined,
      header,
      nullValues,
      columns: flagColumns,
      limit
    };

    const getFileStream = async () => (await open(file, 'r')).createReadStream({ encoding });
    const { workspace, region, database, branch } = await this.parseDatabase();
    const xata = await this.getXataClient();

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

    const { columns } = parseResults;
    await this.migrateSchema({ table, columns, create });

    let importSuccessCount = 0;
    const errors: string[] = [];
    let progress = 0;
    const fileStream = await getFileStream();
    await xata.import.parseCsvStreamBatches({
      fileStream: fileStream,
      fileSizeBytes: await getFileSizeBytes(file),
      parserOptions: { ...csvOptions, columns },
      batchRowCount: batchSize,
      onBatch: async (parseResults, meta) => {
        if (!parseResults.success) {
          throw new Error('Failed to parse CSV file');
        }
        const batchRows = parseResults.data.map(({ data }) => data);
        const importResult = await xata.import.importBatch(
          { workspace, region, database, branch },
          { columns: parseResults.columns, table, batchRows }
        );

        await xata.import.importFiles(
          { database, branch, region, workspace: workspace },
          {
            table,
            ids: importResult.ids,
            files: parseResults.data.map(({ files }) => files)
          }
        );

        importSuccessCount += importResult.ids.length;
        if (importResult.errors) {
          const formattedErrors = importResult.errors.map(
            (error) => `${error.error}. Record: ${JSON.stringify(error.row)}`
          );
          const errorsToLog = formattedErrors.slice(0, Math.abs(ERROR_CONSOLE_LOG_LIMIT - errors.length));
          for (const error of errorsToLog) {
            this.logToStderr(`Import Error: ${error}`);
          }
          errors.push(...formattedErrors);
        }

        progress = Math.max(progress, meta.estimatedProgress);
        this.info(
          `${importSuccessCount} rows successfully imported ${errors.length} errors. ${Math.ceil(
            progress * 100
          )}% complete`
        );
      }
    });
    if (errors.length > 0) {
      await writeFile(ERROR_LOG_FILE, errors.join('\n'), 'utf8');
      this.log(`Import errors written to ${ERROR_LOG_FILE}`);
    }
    fileStream.close();
    this.success('Completed');
    process.exit(0);
  }

  databaseInfo: Awaited<ReturnType<typeof this.getParsedDatabaseURLWithBranch>> | null = null;

  async parseDatabase() {
    if (this.databaseInfo) {
      return this.databaseInfo;
    }
    const { flags } = await this.parseCommand();
    const databaseInfo = await this.getParsedDatabaseURLWithBranch(flags.db, flags.branch, true);
    this.databaseInfo = databaseInfo;
    return databaseInfo;
  }

  async migrateSchema({
    table,
    columns,
    create
  }: {
    table: string;
    columns: Column[];
    create: boolean;
  }): Promise<void> {
    const xata = await this.getXataClient();
    const { workspace, region, database, branch } = await this.parseDatabase();
    const { schema: existingSchema } = await xata.api.branches.getBranchDetails({
      workspace,
      region,
      database,
      branch
    });
    const newSchema = {
      tables: [
        ...existingSchema.tables.filter((t) => t.name !== table),
        { name: table, columns: columns.filter((c) => c.name !== 'id') }
      ]
    };
    const { edits } = await xata.api.migrations.compareBranchWithUserSchema({
      workspace,
      region,
      database,
      branch: 'main',
      schema: newSchema
    });
    if (edits.operations.length > 0) {
      const destructiveOperations = edits.operations
        .map((op) => {
          if (!('removeColumn' in op)) return undefined;
          return op.removeColumn.column;
        })
        .filter((x) => x !== undefined);

      if (destructiveOperations.length > 0) {
        const { destructiveConfirm } = await this.prompt(
          {
            type: 'confirm',
            name: 'destructiveConfirm',
            message: `WARNING: The following columns will be removed and you will lose data. ${destructiveOperations.join(
              ', '
            )}. \nDo you want to continue?`
          },
          create
        );
        if (!destructiveConfirm) {
          process.exit(1);
        }
      }

      const doesTableExist = existingSchema.tables.find((t) => t.name === table);
      const { applyMigrations } = await this.prompt(
        {
          type: 'confirm',
          name: 'applyMigrations',
          message: `Do you want to ${doesTableExist ? 'update' : 'create'} table: ${table} with columns ${columns
            .map((c) => c.name)
            .join(', ')}?`
        },
        create
      );
      if (!applyMigrations) {
        process.exit(1);
      }
      await xata.api.migrations.applyBranchSchemaEdit({ workspace, region, database, branch, edits });
    }
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
  const invalidTypes = types.filter((t) => !importColumnTypes.safeParse(t).success);

  if (invalidTypes.length > 0) {
    throw new Error(
      `Invalid column types: ${invalidTypes.join(', ')} column type should be one of: ${Object.keys(
        importColumnTypes.Values
      ).join(', ')}`
    );
  }

  if (columns?.length !== types?.length) {
    throw new Error('Must specify same number of columns and types');
  }
  return columns.map((name, i) => {
    const type = importColumnTypes.parse(types[i]);
    if (type === 'link') {
      return { name, type, link: { table: name } };
    }
    return { name, type };
  });
};

export function splitCommas(value: unknown): string[] {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((s) => s.trim());
}

const getFileSizeBytes = async (file: string) => {
  const fileHandle = await open(file, 'r');
  const stat = await fileHandle.stat();
  await fileHandle.close();
  return stat.size;
};

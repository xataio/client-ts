import { BaseCommand } from '../../base.js';
import { Config, Flags } from '@oclif/core';
import { Schemas } from '@xata.io/client';
import {
  OpAddColumn,
  OpAlterColumn,
  OpCreateTable,
  OpDropColumn,
  OpDropConstraint,
  OpDropTable,
  OpRenameTable,
  PgRollMigration,
  PgRollMigrationDefinition,
  PgRollOperation
} from '@xata.io/pgroll';
import chalk from 'chalk';
import enquirer from 'enquirer';
import {
  exhaustiveCheck,
  generateLinkReference,
  getBranchDetailsWithPgRoll,
  isBranchPgRollEnabled,
  requiresUpArgument,
  updateConstraint,
  updateLinkComment,
  waitForMigrationToFinish,
  xataColumnTypeToPgRoll,
  xataColumnTypeToPgRollComment,
  xataColumnTypeToPgRollConstraint,
  xataColumnTypeToZeroValue
} from '../../migrations/pgroll.js';
import EditSchemaOld from './edit-old.js';

export type BranchSchemaFormatted =
  | {
      schema: {
        tables: {
          name: string;
          uniqueConstraints: Schemas.BranchSchema['tables'][number]['uniqueConstraints'];
          checkConstraints: Schemas.BranchSchema['tables'][number]['checkConstraints'];
          foreignKeys: Schemas.BranchSchema['tables'][number]['foreignKeys'];
          columns: {
            name: string;
            type: string;
            unique: boolean;
            notNull: boolean;
            defaultValue: any;
            comment: string;
          }[];
        }[];
      };
    }
  | undefined;

export type ColumnData = {
  name: string;
  type: string;
  unique: boolean;
  nullable: boolean;
  defaultValue?: string;
  vector?: {
    dimension: number;
  };
  originalName: string;
  tableName: string;
  link?: {
    table: string;
  };
  file?: {
    defaultPublicAccess: boolean;
  };
  'file[]'?: {
    defaultPublicAccess: boolean;
  };
};

export type AddTablePayload = {
  type: 'add-table';
  table: {
    name: string;
  };
};

export type EditTablePayload = {
  type: 'edit-table';
  table: {
    name: string;
    newName: string;
  };
};

export type DeleteTablePayload = {
  name: string;
};

export type AddColumnPayload = {
  type: 'add-column';
  tableName: string;
  column: ColumnData;
};

export type EditColumnPayload = {
  type: 'edit-column';
  column: ColumnData;
};

export type DeleteColumnPayload = { [tableName: string]: string[] };

export type FormatPayload = {
  type: 'space' | 'migrate' | 'schema';
};

export type SelectChoice = {
  name: FormatPayload | AddTablePayload | EditTablePayload | AddColumnPayload | EditColumnPayload;
  message: string;
  role?: string;
  choices?: SelectChoice[];
  disabled?: boolean;
  hint?: string;
};

export type ValidationState = {
  values: { name: string };
  items: { name: string; input: string }[];
  fields: { name: string; initial: string }[];
};

export type ColumnAdditions = { [tableName: string]: { [columnName: string]: AddColumnPayload['column'] } };

export type ColumnEdits = { [tableName: string]: { [columnName: string]: AddColumnPayload['column'] } };

const { Select, Snippet, Confirm } = enquirer as any;

const xataTypes = [
  'string',
  'int',
  'float',
  'bool',
  'text',
  'multiple',
  'link',
  'email',
  'datetime',
  'vector',
  'json',
  'file',
  'file[]'
];

export default class EditSchema extends BaseCommand<typeof EditSchema> {
  static description = 'Edit the schema';

  static examples = [];

  static flags = {
    ...this.databaseURLFlag,
    branch: this.branchFlag,
    source: Flags.boolean({
      description: 'Edit the schema as a JSON document in your default editor'
    })
  };

  static args = {};

  branchDetails: BranchSchemaFormatted;
  workspace!: string;
  region!: string;
  database!: string;
  branch!: string;

  tableAdditions: AddTablePayload['table'][] = [];
  tableEdits: EditTablePayload['table'][] = [];
  tableDeletions: DeleteTablePayload[] = [];

  columnEdits: ColumnEdits = {};
  columnAdditions: ColumnAdditions = {};
  columnDeletions: DeleteColumnPayload = {};

  currentMigration: PgRollMigration = { operations: [] };

  activeIndex: number = 0;

  async showSchemaEdit() {
    this.clear();
    const tableChoices: SelectChoice[] = [];
    const select = new Select({
      message: 'Schema for database test:main',
      initial: this.activeIndex,
      choices: [
        {
          name: { type: 'schema' },
          message: 'Tables',
          role: 'heading',
          choices: tableChoices
        }
      ],
      footer:
        'Use the ↑ ↓ arrows to move across the schema, enter to edit or add things, delete or backspace to delete things.'
    });

    const tables = [
      ...(this.branchDetails?.schema?.tables ?? []),
      ...this.tableAdditions.map((addition) => ({
        name: addition.name,
        columns: []
      }))
    ];

    for (const table of tables) {
      tableChoices.push({
        name: { type: 'edit-table', table: { name: table.name, newName: table.name } },
        message: this.renderTableMessage(table.name),
        choices: [
          ...table.columns.map((column) => {
            const col = formatSchemaColumnToColumnData({
              column: { ...column, originalName: column.name },
              tableName: table.name
            });
            return {
              name: {
                type: 'edit-column',
                column: col
              },
              message: this.renderColumnMessage({ column: col }),
              disabled: editTableDisabled(table.name, this.tableDeletions)
            } as SelectChoice;
          }),
          ...Object.values(this.columnAdditions[table.name] ?? []).map((column) => {
            const formatted = { ...column, tableName: table.name, originalName: column.name };
            return {
              name: { type: 'edit-column', column: formatted },
              message: this.renderColumnMessage({ column: formatted }),
              disabled: editTableDisabled(table.name, this.tableDeletions)
            } as SelectChoice;
          }),
          {
            name: {
              type: 'add-column',
              tableName: table.name,
              column: { originalName: '', tableName: table.name, name: '', type: '', unique: false, nullable: true }
            },
            message: `${chalk.green('+')} Add a column`,
            disabled: editTableDisabled(table.name, this.tableDeletions),
            hint: 'Add a column to a table'
          }
        ]
      });
    }

    tableChoices.push(
      createSpace(),
      {
        message: `${chalk.green('+')} Add a table`,
        name: { type: 'add-table', table: { name: '' } }
      },
      {
        message: `${chalk.green('►')} Run migration`,
        name: { type: 'migrate' },
        hint: 'Run the migration'
      }
    );

    select.on('keypress', async (char: string, key: { name: string; action: string }) => {
      this.activeIndex = select.state.index;
      const selectedItem = select.state.choices[select.state.index];
      try {
        if (key.name === 'backspace' || key.name === 'delete') {
          if (!selectedItem) return;
          const choice = selectedItem.name;
          if (typeof choice !== 'object') return;
          if (choice.type === 'edit-table') {
            await select.cancel();
            await this.toggleTableDelete({ initialTableName: choice.table.name });
            await this.showSchemaEdit();
          }
          if (choice.type === 'edit-column') {
            await select.cancel();
            await this.toggleColumnDelete(choice);
            await this.showSchemaEdit();
          }
        }
      } catch (err) {
        if (err) throw err;
        this.clear();
      }
    });

    try {
      const result: SelectChoice['name'] = await select.run();
      if (result.type === 'add-table') {
        await this.showAddTable(result.table);
      } else if (result.type === 'edit-column') {
        if (editColumnDisabled(result.column, this.columnDeletions)) {
          await this.showSchemaEdit();
        } else {
          await this.showColumnEdit(result.column);
        }
      } else if (result.type === 'edit-table') {
        if (editTableDisabled(result.table.name, this.tableDeletions)) {
          await this.showSchemaEdit();
        } else {
          await this.showTableEdit({ initialTableName: result.table.name });
        }
      } else if (result.type === 'add-column') {
        await this.showAddColumn(result);
      } else if (result.type === 'migrate') {
        await this.migrate();
      } else if (result.type === 'schema' || result.type === 'space') {
        await this.showSchemaEdit();
      } else {
        exhaustiveCheck(result.type);
      }
    } catch (error) {
      if (error) throw error;
    }
    this.clear();
  }

  async migrate() {
    this.clear();
    this.currentMigration = { operations: [] };
    this.currentMigration.operations = editsToMigrations(this);
    const valid = validateMigration(this.currentMigration);
    if (valid.success) {
      const prompt = new Confirm({
        name: 'question',
        message: `Are you sure you want to run the migration? ${JSON.stringify(this.currentMigration, null, 2)}`
      });
      try {
        const answer = await prompt.run();
        if (!answer) {
          await this.showSchemaEdit();
          return;
        }
        const xata = await this.getXataClient();

        const submitMigrationRessponse = await xata.api.migrations.applyMigration({
          pathParams: {
            workspace: this.workspace,
            region: this.region,
            dbBranchName: `${this.database}:${this.branch}`
          },
          body: { ...this.currentMigration, adaptTables: true }
        });

        await waitForMigrationToFinish(
          xata.api,
          this.workspace,
          this.region,
          this.database,
          this.branch,
          submitMigrationRessponse.jobID
        );

        const alterLinkColumns = this.currentMigration.operations.reduce((acc, op) => {
          const operation = updateLinkComment(this.branchDetails, op);
          if (operation) acc.push(...operation);
          return acc;
        }, [] as PgRollOperation[]);

        if (alterLinkColumns.length > 0) {
          const { jobID: alterLinkColumnId } = await xata.api.migrations.applyMigration({
            pathParams: {
              workspace: this.workspace,
              region: this.region,
              dbBranchName: `${this.database}:${this.branch}`
            },
            body: { operations: alterLinkColumns }
          });

          await waitForMigrationToFinish(
            xata.api,
            this.workspace,
            this.region,
            this.database,
            this.branch,
            alterLinkColumnId
          );
        }

        const constraintRenames = this.currentMigration.operations.reduce((acc, op) => {
          const operation = updateConstraint(this.branchDetails, op);
          if (operation) acc.push(...operation);
          return acc;
        }, [] as PgRollOperation[]);

        if (constraintRenames.length > 0) {
          const { jobID: constraintRenameJobID } = await xata.api.migrations.applyMigration({
            pathParams: {
              workspace: this.workspace,
              region: this.region,
              dbBranchName: `${this.database}:${this.branch}`
            },
            body: { operations: constraintRenames }
          });

          await waitForMigrationToFinish(
            xata.api,
            this.workspace,
            this.region,
            this.database,
            this.branch,
            constraintRenameJobID
          );
        }

        this.success('Migration completed!');
        process.exit(0);
      } catch (err) {
        if (err) throw err;
        // User cancelled
        await this.showSchemaEdit();
        return;
      }
    } else {
      this.logJson(this.currentMigration);
      this.toErrorJson('Migration is invalid:' + valid.error.errors.flatMap((e) => e.message).join('\n'));
    }
  }

  getColumnNameEdit({ column }: { column: EditColumnPayload['column'] }) {
    return this.columnEdits[column.tableName]?.[column.originalName]?.name;
  }

  getColumnNullable({ column }: { column: EditColumnPayload['column'] }) {
    return this.columnEdits[column.tableName]?.[column.originalName]?.nullable ?? column.nullable;
  }

  getColumnUnique({ column }: { column: EditColumnPayload['column'] }) {
    return this.columnEdits[column.tableName]?.[column.originalName]?.unique ?? column.unique;
  }

  renderColumnMessage({ column }: { column: EditColumnPayload['column'] }) {
    const maybeNewColumnName = this.getColumnNameEdit({ column });
    const isColumnDeleted = Object.entries(this.columnDeletions)
      .filter((entry) => entry[0] === column.tableName)
      .find((entry) => entry[1].includes(column.originalName));
    const isTableDeleted = this.tableDeletions.find(({ name }) => name === column.tableName);

    const unique = () => {
      const currentUniqueValue = this.getColumnUnique({ column });
      if (currentUniqueValue !== column.unique) {
        return currentUniqueValue ? chalk.green('unique') : chalk.green('not unique');
      }
      return currentUniqueValue ? chalk.gray.italic('unique') : '';
    };

    const nullable = () => {
      const currentNullableValue = this.getColumnNullable({ column });
      if (currentNullableValue !== column.nullable) {
        return currentNullableValue ? chalk.green('nullable') : chalk.green('not nullable');
      }
      return currentNullableValue ? '' : chalk.gray.italic('not nullable');
    };

    const metadata = [
      `${chalk.gray.italic(column.type)}${column.type === 'link' ? ` → ${chalk.gray.italic(column.link?.table)}` : ''}`,
      unique(),
      nullable(),
      column.defaultValue ? chalk.gray.italic(`default: ${column.defaultValue}`) : ''
    ]
      .filter(Boolean)
      .join(' ');

    if (isColumnDeleted || isTableDeleted) {
      return `  - ${chalk.red.strikethrough(column.originalName)} (${metadata})`;
    }
    // Checking names are not the same because it is possible only nullable or unique changed
    if (maybeNewColumnName && maybeNewColumnName !== column.originalName) {
      return ` - ${chalk.yellow.strikethrough(column.originalName)} -> ${chalk.bold(maybeNewColumnName)} (${metadata})`;
    }
    return `- ${chalk.cyan(column.originalName)} (${metadata})`;
  }

  renderTableNameEdited(tableName: string) {
    return this.tableEdits.find((edit) => edit.name === tableName)?.newName;
  }

  renderTableMessage(originalName: string, newTable: boolean = false) {
    const tableEdit = this.tableEdits.find(({ name }) => name === originalName);
    const tableDelete = this.tableDeletions.find(({ name }) => name === originalName);
    if (tableDelete) {
      return `• ${chalk.red.strikethrough(originalName)}`;
    }
    if (tableEdit) {
      return `• ${chalk.yellow.strikethrough(originalName)} -> ${chalk.bold(
        this.renderTableNameEdited(originalName) ?? originalName
      )}`;
    }
    return newTable ? `• ${chalk.bold(originalName)}` : `• ${chalk.bold(originalName)}`;
  }

  async run(): Promise<void> {
    const { flags } = await this.parseCommand();

    const { workspace, region, database, branch } = await this.getParsedDatabaseURLWithBranch(flags.db, flags.branch);
    this.workspace = workspace;
    this.region = region;
    this.database = database;
    this.branch = branch;

    const config = await Config.load();

    const xata = await this.getXataClient();
    const branchDetails = await getBranchDetailsWithPgRoll(xata, {
      workspace,
      region,
      database,
      branch
    });
    if (!branchDetails) this.error('Could not get the schema from the current branch');

    if (isBranchPgRollEnabled(branchDetails)) {
      if (flags.source) {
        this.warn('Schema source editing is not supported yet. Please run the command without the --source flag.');
        process.exit(0);
      } else {
        this.branchDetails = branchDetails as any;
        await this.showSchemaEdit();
      }
    } else {
      const editOld = new EditSchemaOld(this.argv, config);
      editOld.launch({
        workspace: this.workspace,
        region: this.region,
        database: this.database,
        branch: this.branch
      });
    }
  }

  clear() {
    process.stdout.write('\x1b[2J');
    process.stdout.write('\x1b[0f');
  }

  footer() {
    return '\nUse the ↑ ↓ arrows to move across fields, enter to submit and escape to cancel.';
  }

  async toggleTableDelete({ initialTableName }: { initialTableName: string }) {
    const indexOfExistingEntry = this.tableDeletions.findIndex(({ name }) => name === initialTableName);
    indexOfExistingEntry > -1
      ? this.tableDeletions.splice(indexOfExistingEntry, 1)
      : this.tableDeletions.push({ name: initialTableName });
  }

  async toggleColumnDelete({ column }: { column: EditColumnPayload['column'] }) {
    const existingEntryIndex = this.columnDeletions[column.tableName]?.findIndex(
      (name) => name === column.originalName
    );
    if (existingEntryIndex > -1) {
      this.columnDeletions[column.tableName].splice(existingEntryIndex, 1);
    } else {
      !this.columnDeletions[column.tableName]
        ? (this.columnDeletions[column.tableName] = [column.originalName])
        : this.columnDeletions[column.tableName].push(column.originalName);
    }
  }

  async showColumnEdit(column: EditColumnPayload['column']) {
    this.clear();
    const template = `
      name: \${name},
      column: ${column.originalName},
      nullable: \${nullable},
      unique: \${unique},
      `;
    // TODO support default https://github.com/xataio/pgroll/issues/327
    // TODO support changing type https://github.com/xataio/pgroll/issues/328
    const snippet = new Snippet({
      message: 'Edit a column',
      fields: [
        {
          name: 'name',
          message: 'The name of the column',
          initial: this.getColumnNameEdit({ column }) ?? column.originalName,
          validate: this.validateColumnName
        },
        {
          name: 'nullable',
          message: `Whether the column can be null.`,
          initial: this.getColumnNullable({ column }) ? 'true' : 'false',
          validate: this.validateColumnNullable
        },
        {
          name: 'unique',
          message: `Whether the column is unique.`,
          initial: this.getColumnUnique({ column }) ? 'true' : 'false',
          validate: this.validateColumnUnique
        }
      ],
      footer: this.footer,
      template
    });

    try {
      const { values } = await snippet.run();
      const existingEntry = this.columnEdits[column.tableName]?.[column.originalName];

      const unchanged =
        column.originalName === values.name &&
        column.nullable === parseBoolean(values.nullable) &&
        column.unique === parseBoolean(values.unique);
      if (unchanged && existingEntry) {
        delete this.columnEdits[column.tableName][column.originalName];
      } else if (!unchanged && existingEntry) {
        existingEntry.name = values.name;
        existingEntry.nullable = parseBoolean(values.nullable) ?? true;
        existingEntry.unique = parseBoolean(values.unique) ?? false;
      } else if (!unchanged && !existingEntry) {
        if (!this.columnEdits[column.tableName]) this.columnEdits[column.tableName] = {};
        if (!this.columnEdits[column.tableName][column.originalName])
          this.columnEdits[column.tableName][column.originalName] = {} as any;
        this.columnEdits[column.tableName][column.originalName] = formatSchemaColumnToColumnData({
          column: {
            ...column,
            ...values,
            originalName: column.originalName,
            notNull: parseBoolean(values.nullable) === false ? true : false,
            unique: parseBoolean(values.unique) ? true : false
          },
          tableName: column.tableName
        });
      }
      await this.showSchemaEdit();
    } catch (err) {
      if (err) throw err;
      // User cancelled
      await this.showSchemaEdit();
      return;
    }
  }

  async showAddColumn({
    tableName,
    column
  }: {
    tableName: AddColumnPayload['tableName'];
    column: AddColumnPayload['column'];
  }) {
    this.clear();
    const template = `
        name: \${name},
        nullable: \${nullable},
        unique: \${unique},
        type: \${type},
        default: \${default}
        link: \${link}
        vectorDimension: \${vectorDimension}
        defaultPublicAccess: \${defaultPublicAccess}
      },
      table: ${tableName}`;

    const snippet = new Snippet({
      message: 'Add a column',
      fields: [
        {
          name: 'name',
          message: 'The name of the column',
          validate: this.validateColumnName
        },
        {
          name: 'type',
          message: `The type of the column ${xataTypes}`,
          validate: (value: string) => {
            if (value === undefined) return 'Type cannot be undefined';
            if (emptyString(value)) return 'Type cannot be empty';
            if (!xataTypes.includes(value))
              return 'Invalid xata type. Please specify one of the following: ' + xataTypes;
          }
        },
        {
          name: 'nullable',
          message: `Whether the column can be null.`,
          validate: this.validateColumnNullable
        },
        {
          name: 'unique',
          message: `Whether the column is unique.`,
          validate: this.validateColumnUnique
        },
        {
          name: 'default',
          message: `The default for the column.`
        },
        {
          name: 'link',
          message: 'Linked table. Only required for columns that are links. Will be ignored if type is not link.',
          validate: (value: string, state: ValidationState) => {
            const columnType = state.items.find(({ name }) => name === 'type')?.input;
            if ((value === undefined || emptyString(value)) && columnType === 'link')
              return 'Cannot be empty string when the type is link';
            return true;
          }
        },
        {
          name: 'vectorDimension',
          message: 'Vector dimension. Only required for vector columns. Will be ignored if type is not vector.',
          validate: (value: string, state: ValidationState) => {
            const columnType = state.items.find(({ name }) => name === 'type')?.input;
            if ((value === undefined || emptyString(value)) && columnType === 'vector')
              return 'Cannot be empty string when the type is vector';
            return true;
          }
        },
        {
          name: 'defaultPublicAccess',
          message:
            'Default public access. Only required for file or file[] columns. Will be ignored if type is not file or file[].',
          validate: (value: string, state: ValidationState) => {
            const columnType = state.items.find(({ name }) => name === 'type')?.input;
            if ((value === undefined || emptyString(value)) && (columnType === 'file' || columnType === 'file[]'))
              return 'Cannot be empty string when the type is file or file[]. Please input true or false';
            return true;
          }
        }
      ],
      footer: this.footer,
      template
    });
    try {
      const { values } = await snippet.run();
      if (!this.columnAdditions[tableName]) this.columnAdditions[tableName] = {};
      if (!this.columnAdditions[tableName][values.name]) this.columnAdditions[tableName][values.name] = {} as any;
      this.columnAdditions[tableName][values.name] = formatSchemaColumnToColumnData({
        column: {
          ...column,
          ...values,
          originalName: column.originalName,
          'file[]':
            values.type === 'file[]'
              ? { defaultPublicAccess: parseBoolean(values.defaultPublicAccess) ?? false }
              : undefined,
          file:
            values.type === 'file'
              ? { defaultPublicAccess: parseBoolean(values.defaultPublicAccess) ?? false }
              : undefined,
          vector: values.vectorDimension
            ? {
                dimension: values.vectorDimension
              }
            : undefined,
          link: values.link
            ? {
                table: values.link
              }
            : undefined,
          defaultValue: values.default,
          notNull: parseBoolean(values.nullable) === false ? true : false,
          unique: parseBoolean(values.unique) ? true : false
        },
        tableName: column.tableName
      });
      await this.showSchemaEdit();
    } catch (err) {
      if (err) throw err;
      // User cancelled
      await this.showSchemaEdit();
      return;
    }
  }

  async showAddTable({ name }: { name: AddTablePayload['table']['name'] }) {
    this.clear();
    const snippet = new Snippet({
      message: 'Add a table',
      initial: { name: name },
      fields: [
        {
          name: 'name',
          message: 'The table name',
          validate: this.validateTableName
        }
      ],
      footer: this.footer,
      template: `
       Name: \${name}
       `
    });

    try {
      const answer: { values: { name: string } } = await snippet.run();
      this.tableAdditions.push({ name: answer.values.name });
    } catch (err) {
      if (err) throw err;
    }
    await this.showSchemaEdit();
  }

  async showTableEdit({ initialTableName }: { initialTableName: string }) {
    this.clear();
    const snippet = new Snippet({
      message: 'Edit table name',
      fields: [
        {
          name: 'name',
          message: 'The table name',
          initial: this.renderTableNameEdited(initialTableName) ?? initialTableName,
          validate: this.validateTableName
        }
      ],
      footer: this.footer,
      template: `
         Name: \${name}
         `
    });

    try {
      const answer: { values: { name: string } } = await snippet.run();
      const existingEntry = this.tableEdits.find(({ name }) => name === initialTableName);
      const changed = answer.values.name !== initialTableName;
      if (existingEntry && changed) {
        existingEntry.newName = answer.values.name;
      } else if (existingEntry && !changed) {
        this.tableEdits = this.tableEdits.filter(({ name }) => name !== initialTableName);
      } else if (!existingEntry && changed) {
        this.tableEdits.push({ name: initialTableName, newName: answer.values.name });
      }
      await this.showSchemaEdit();
    } catch (err) {
      if (err) throw err;
      // User cancelled
      await this.showSchemaEdit();
      return;
    }
  }

  validateTableName = (value: string, state: ValidationState) => {
    if (value === undefined) return 'Name cannot be undefined';
    if (emptyString(value)) return 'Name cannot be empty';
    if (value === state.fields.find((field) => field.name === 'name')?.initial) return true;
    return !emptyString(value);
  };

  validateColumnName = (value: string) => {
    if (value === undefined) return 'Name cannot be undefined';
    if (emptyString(value)) return 'Name cannot be empty';
    return true;
  };
  validateColumnNullable = (value: string) => {
    if (parseBoolean(value) === undefined) return 'Invalid value. Nullable field must be a boolean';
    return true;
  };
  validateColumnUnique = (value: string) => {
    if (parseBoolean(value) === undefined) return 'Invalid value. Unique field must be a boolean';
    return true;
  };
}

const editTableDisabled = (name: string, tableDeletions: DeleteTablePayload[]) => {
  return tableDeletions.some(({ name: tableName }) => tableName === name);
};

/** Necessary because disabling prevents the user from "undeleting" a column */
const editColumnDisabled = (column: EditColumnPayload['column'], columnDeletions: DeleteColumnPayload) => {
  return columnDeletions[column.tableName]?.includes(column.originalName);
};

const validateMigration = (migration: object) => {
  return PgRollMigrationDefinition.safeParse(migration);
};

const emptyString = (value: string) => {
  return value === '';
};

const createSpace = (): SelectChoice => {
  return { name: { type: 'space' }, message: ' ', role: 'heading' };
};

export const editsToMigrations = (command: EditSchema) => {
  // Duplicating here because if we remove items from class state they dont show on UI
  // TODO better way to deep copy? If not surround with try catch

  let localTableAdditions: (AddTablePayload['table'] & { columns?: AddColumnPayload['column'][] })[] = JSON.parse(
    JSON.stringify(command.tableAdditions)
  );
  let localTableEdits: EditTablePayload['table'][] = JSON.parse(JSON.stringify(command.tableEdits));
  let localTableDeletions: DeleteTablePayload[] = JSON.parse(JSON.stringify(command.tableDeletions));

  const localColumnAdditions: ColumnAdditions = JSON.parse(JSON.stringify(command.columnAdditions));
  const localColumnEdits: ColumnEdits = JSON.parse(JSON.stringify(command.columnEdits));
  const localColumnDeletions: DeleteColumnPayload = JSON.parse(JSON.stringify(command.columnDeletions));

  const isTableDeleted = (name: string) => {
    return localTableDeletions.find(({ name: tableName }) => tableName === name);
  };

  // Remove column edits, additions and deletions for tables that are deleted
  for (const tableName of Object.keys({
    ...localColumnAdditions,
    ...localColumnEdits,
    ...localColumnDeletions
  })) {
    if (isTableDeleted(tableName)) {
      delete localColumnAdditions[tableName];
      delete localColumnEdits[tableName];
      delete localColumnDeletions[tableName];
    }
  }

  // If column was deleted then remove edits, and additions and deletions if new
  for (const [tableName, columns] of Object.entries(localColumnDeletions)) {
    for (const columnName of columns) {
      const columnWasEdited = localColumnEdits[tableName]?.[columnName];
      if (columnWasEdited) {
        // Remove the edit
        delete localColumnEdits[tableName][columnName];
      }
      const columnWasAdded = localColumnAdditions[tableName]?.[columnName];
      if (columnWasAdded) {
        // Remove deletions
        localColumnDeletions[tableName] = localColumnDeletions[tableName].filter((col) => col !== columnName);
        // Remove the addition
        delete localColumnAdditions[tableName][columnName];
      }
    }
  }

  // Remove table edits, additions and deletions for tables that are newly added and also deleted
  localTableAdditions = localTableAdditions.filter(({ name }) => !isTableDeleted(name));
  localTableEdits = localTableEdits.filter(({ name }) => !isTableDeleted(name));
  localTableDeletions = localTableDeletions.filter(
    ({ name }) => !command.tableAdditions.find((addition) => addition.name === name)
  );

  const editsToNewTable = localTableEdits.filter(({ name }) =>
    localTableAdditions.find((addition) => addition.name === name)
  );
  localTableEdits = localTableEdits.filter(({ name }) => !editsToNewTable.find((edit) => edit.name === name));
  localTableAdditions = localTableAdditions.map((addition) => {
    const edit = editsToNewTable.find(({ name }) => name === addition.name);
    return edit
      ? {
          name: edit.newName
        }
      : addition;
  });

  // Bundle edit columns into new columns
  for (const [tableName, columns] of Object.entries(localColumnEdits)) {
    for (const [columnName, column] of Object.entries(columns)) {
      const columnIsNew = localColumnAdditions[tableName]?.[columnName];
      if (columnIsNew) {
        // Add to column additions
        localColumnAdditions[tableName][columnName] = {
          ...column,
          name: column.name,
          unique: column.unique ?? false,
          nullable: column.nullable ?? true
        };
        // Delete column from edits
        delete localColumnEdits[tableName][columnName];
        if (Object.keys(localColumnEdits[tableName]).length === 0) {
          delete localColumnEdits[tableName];
        }
      }
    }
  }

  // Bundle new columns into new tables
  for (const [tableName, columns] of Object.entries(localColumnAdditions)) {
    const tableIsNew = localTableAdditions.find((addition) => addition.name === tableName);
    if (tableIsNew) {
      for (const [columnName, column] of Object.entries(columns)) {
        const localTableAddition = localTableAdditions.find((addition) => addition.name === tableName);
        if (localTableAddition) {
          if (!localTableAddition?.columns) localTableAddition.columns = [];
          // Add to table additions
          localTableAddition?.columns.push(column);
        }
        // Delete from column additions
        delete localColumnAdditions[tableName][columnName];
      }
      delete localColumnAdditions[tableName];
    }
  }

  const columnDeletions: { drop_column: OpDropColumn }[] = Object.entries(localColumnDeletions)
    .map((entry) => {
      return entry[1].map((e) => {
        return {
          drop_column: {
            column: e,
            table: entry[0]
          }
        };
      });
    })
    .flat();

  const tableDeletions: { drop_table: OpDropTable }[] = localTableDeletions.map(({ name }) => {
    return {
      drop_table: {
        name: name
      }
    };
  });

  const columnAdditions: { add_column: OpAddColumn }[] = [];
  for (const [_, columns] of Object.entries(localColumnAdditions)) {
    columnAdditions.push(
      ...formatColumnDataToPgroll(Object.values(columns)).map(({ column, tableName, up }) => {
        return {
          add_column: {
            up,
            column,
            table: tableName
          }
        };
      })
    );
  }

  const tableAdditions: { create_table: OpCreateTable }[] = localTableAdditions.map(({ name, columns }) => {
    return {
      create_table: {
        name: name,
        columns: formatColumnDataToPgroll(columns ?? []).map(({ column }) => column)
      }
    };
  });

  const tableEdits: { rename_table: OpRenameTable }[] = localTableEdits.map(({ name, newName }) => {
    return {
      rename_table: {
        from: name,
        to: newName
      }
    };
  });

  const columnEdits: ({ alter_column: OpAlterColumn } | { drop_constraint: OpDropConstraint })[] = [];
  for (const [_, columns] of Object.entries(localColumnEdits)) {
    for (const data of Object.values(columns)) {
      const { name, nullable, unique, originalName } = data;
      formatColumnDataToPgroll([data]).map(({ tableName }) => {
        const originalField = command.branchDetails?.schema.tables
          .find((table) => table.name === tableName)
          ?.columns.find((col) => col.name === originalName);
        if (!originalField) {
          throw new Error(`Could not find original field ${originalName} in table ${tableName}`);
        }

        const nameChanged = name !== originalField.name;
        const nullableChanged = nullable !== !originalField.notNull;
        const uniqueAdded = unique !== originalField.unique && unique === true;
        const uniqueRemoved = unique !== originalField.unique && unique === false;

        if (uniqueRemoved) {
          const table = command.branchDetails?.schema.tables.find((table) => tableName === table.name);
          const uniqueConstraints: { name: string }[] = Object.values((table as any)?.uniqueConstraints ?? {});
          const uniqueConstraintName = uniqueConstraints.find(
            (constraint: any) => constraint.columns.length === 1 && constraint.columns[0] === originalField.name
          )?.name;

          const maybeDropStatement =
            uniqueRemoved && uniqueConstraintName
              ? {
                  drop_constraint: {
                    table: tableName,
                    column: originalField.name,
                    name: uniqueConstraintName,
                    up: `"${originalField.name}"`,
                    down: `"${originalField.name}"`
                  }
                }
              : undefined;

          if (maybeDropStatement) {
            columnEdits.push(maybeDropStatement);
          }
        }

        const uniqueValue = uniqueAdded
          ? {
              unique: {
                name: `${tableName}_${originalField.name}_unique`
              },
              up: `"${originalField.name}"`,
              down: `"${originalField.name}"`
            }
          : undefined;

        const nullValue = nullableChanged
          ? {
              up:
                nullable === false
                  ? `(SELECT CASE WHEN "${originalField.name}" IS NULL THEN ${xataColumnTypeToZeroValue(
                      originalField.type,
                      originalField.defaultValue
                    )} ELSE "${originalField.name}" END)`
                  : `"${originalField.name}"`,
              down:
                nullable === true
                  ? `"${originalField.name}"`
                  : `(SELECT CASE WHEN "${originalField.name}" IS NULL THEN ${xataColumnTypeToZeroValue(
                      originalField.type,
                      originalField.defaultValue
                    )} ELSE "${originalField.name}" END)`
            }
          : undefined;

        const alterStatement = {
          alter_column: {
            column: originalField.name,
            table: tableName,
            name: nameChanged ? name : undefined,
            nullable: nullableChanged ? nullable : undefined,
            ...uniqueValue,
            ...nullValue
          }
        };

        if (nullableChanged || nameChanged || uniqueAdded) {
          columnEdits.push(alterStatement);
        }
      });
    }
  }

  return [...columnDeletions, ...tableDeletions, ...tableAdditions, ...columnAdditions, ...columnEdits, ...tableEdits];
};

function parseBoolean(value?: string) {
  if (!value) return undefined;
  const val = value.toLowerCase();
  if (['true', 't', '1', 'y', 'yes'].includes(val)) return true;
  if (['false', 'f', '0', 'n', 'no'].includes(val)) return false;
}

const formatSchemaColumnToColumnData = ({
  column,
  tableName
}: {
  column: Schemas.Column & { originalName: string };
  tableName: string;
}): EditColumnPayload['column'] => {
  return {
    name: column.name,
    unique: column.unique ?? false,
    type: column.type,
    nullable: column.notNull === true ? false : true,
    tableName: tableName,
    originalName: column.originalName,
    defaultValue: column.defaultValue ?? undefined,
    vector: column.vector ? { dimension: column.vector.dimension } : undefined,
    link: column.type === 'link' && column.link?.table ? { table: column.link.table } : undefined,
    file: column.type === 'file' ? { defaultPublicAccess: column.file?.defaultPublicAccess ?? false } : undefined,
    'file[]':
      column.type === 'file[]' ? { defaultPublicAccess: column['file[]']?.defaultPublicAccess ?? false } : undefined
  };
};

const formatColumnDataToPgroll = (
  columns: AddColumnPayload['column'][]
): { column: OpAddColumn['column']; tableName: string; up?: string }[] => {
  return columns.map((column) => ({
    tableName: column.tableName,
    up: requiresUpArgument(column.nullable === false, column.defaultValue)
      ? xataColumnTypeToZeroValue(column.type as any, column.defaultValue)
      : undefined,
    column: {
      name: column.name,
      type: xataColumnTypeToPgRoll(column.type as any),
      references:
        column.type === 'link'
          ? generateLinkReference({ column: column.name, table: column.link?.table ?? '' })
          : undefined,
      default:
        column.defaultValue !== null && column.defaultValue !== undefined ? `'${column.defaultValue}'` : undefined,
      nullable: parseBoolean(String(column.nullable)) ?? true,
      unique: parseBoolean(String(column.unique)) ?? false,
      check: xataColumnTypeToPgRollConstraint(column as any, column.tableName),
      comment: xataColumnTypeToPgRollComment(column as any)
    }
  }));
};

export type BranchSchemaFormatted =
  | {
      schema: {
        tables: {
          name: string;
          uniqueConstraints: Schemas.BranchSchema['tables'][number]['uniqueConstraints'];
          checkConstraints: Schemas.BranchSchema['tables'][number]['checkConstraints'];
          foreignKeys: Schemas.BranchSchema['tables'][number]['foreignKeys'];
          columns: {
            name: string;
            type: string;
            unique: boolean;
            notNull: boolean;
            defaultValue: any;
            comment: string;
          }[];
        }[];
      };
    }
  | undefined;

export type ColumnData = {
  name: string;
  type: string;
  unique: boolean;
  nullable: boolean;
  defaultValue?: string;
  vector?: {
    dimension: number;
  };
  originalName: string;
  tableName: string;
  link?: {
    table: string;
  };
  file?: {
    defaultPublicAccess: boolean;
  };
  'file[]'?: {
    defaultPublicAccess: boolean;
  };
};

export type AddTablePayload = {
  type: 'add-table';
  table: {
    name: string;
  };
};

export type EditTablePayload = {
  type: 'edit-table';
  table: {
    name: string;
    newName: string;
  };
};

export type DeleteTablePayload = {
  name: string;
};

export type AddColumnPayload = {
  type: 'add-column';
  tableName: string;
  column: ColumnData;
};

export type EditColumnPayload = {
  type: 'edit-column';
  column: ColumnData;
};

export type DeleteColumnPayload = { [tableName: string]: string[] };

export type FormatPayload = {
  type: 'space' | 'migrate' | 'schema';
};

export type SelectChoice = {
  name: FormatPayload | AddTablePayload | EditTablePayload | AddColumnPayload | EditColumnPayload;
  message: string;
  role?: string;
  choices?: SelectChoice[];
  disabled?: boolean;
  hint?: string;
};

export type ValidationState = {
  values: { name: string };
  items: { name: string; input: string }[];
  fields: { name: string; initial: string }[];
};

export type ColumnAdditions = { [tableName: string]: { [columnName: string]: AddColumnPayload['column'] } };

export type ColumnEdits = { [tableName: string]: { [columnName: string]: AddColumnPayload['column'] } };

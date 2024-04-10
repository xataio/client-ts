import { BaseCommand } from '../../base.js';
import { Flags } from '@oclif/core';
import { Schemas, XataApiClient } from '@xata.io/client';
import {
  OpAddColumn,
  OpAlterColumn,
  OpCreateTable,
  OpDropColumn,
  OpDropTable,
  OpRenameTable,
  PgRollMigration,
  PgRollMigrationDefinition
} from '@xata.io/pgroll';
import chalk from 'chalk';
import enquirer from 'enquirer';
import {
  AddColumnPayload,
  AddTablePayload,
  ColumnAdditionData,
  ColumnEditData,
  DeleteColumnPayload,
  DeleteTablePayload,
  EditColumnPayload,
  EditTablePayload,
  SelectChoice,
  ValidationState
} from './types.js';
import {
  exhaustiveCheck,
  generateLinkReference,
  getBranchDetailsWithPgRoll,
  requiresUpArgument,
  xataColumnTypeToPgRoll,
  xataColumnTypeToPgRollComment,
  xataColumnTypeToPgRollConstraint,
  xataColumnTypeToZeroValue
} from '../../migrations/pgroll.js';

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
      description: 'Edit a migration as a JSON document in your default editor'
    })
  };

  static args = {};

  branchDetails: Schemas.DBBranch | undefined;
  workspace!: string;
  region!: string;
  database!: string;
  branch!: string;

  tableAdditions: AddTablePayload['table'][] = [];
  tableEdits: EditTablePayload['table'][] = [];
  tableDeletions: DeleteTablePayload[] = [];
  columnEdits: ColumnEditData = {};
  columnAdditions: ColumnAdditionData = {};
  columnDeletions: DeleteColumnPayload = {};

  currentMigration: PgRollMigration = { operations: [] };

  activeIndex: number = 0;

  async showSchemaEdit() {
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

    for (const table of [
      ...this.branchDetails!.schema.tables,
      ...this.tableAdditions.map((addition) => ({
        name: addition.name,
        columns: []
      }))
    ]) {
      tableChoices.push({
        name: { type: 'edit-table', table: { name: table.name, newName: table.name } },
        message: this.renderTableMessage(table.name),
        choices: [
          ...Object.values(table.columns)
            .filter(({ name }) => !isReservedXataFieldName(name))
            .map((column) => {
              const col: EditColumnPayload['column'] = {
                // todo abstract into function
                name: column.name,
                unique: column.unique ?? false,
                type: column.type,
                nullable: column.notNull === true ? false : true,
                tableName: table.name,
                originalName: column.name,
                defaultValue: column.defaultValue ?? undefined,
                vector: column.vector ? { dimension: column.vector.dimension } : undefined,
                link: column.type === 'link' && column.link?.table ? { table: column.link.table } : undefined,
                file: column.type === 'file' ? { defaultPublicAccess: false } : undefined,
                'file[]': column.type === 'file[]' ? { defaultPublicAccess: false } : undefined
              };
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
        await select.cancel();
        await this.showAddTable(result.table);
      } else if (result.type === 'edit-column') {
        await select.cancel();
        if (editColumnDisabled(result.column, this.columnDeletions)) {
          await this.showSchemaEdit();
        } else {
          await this.showColumnEdit(result.column);
        }
      } else if (result.type === 'edit-table') {
        await select.cancel();
        if (editTableDisabled(result.table.name, this.tableDeletions)) {
          await this.showSchemaEdit();
        } else {
          await this.showTableEdit({ initialTableName: result.table.name });
        }
      } else if (result.type === 'add-column') {
        await select.cancel();
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
          body: this.currentMigration
        });

        await waitForMigrationToFinish(
          xata.api,
          this.workspace,
          this.region,
          this.database,
          this.branch,
          submitMigrationRessponse.jobID
        );

        this.success('Migration completed!');
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

  renderColumnNameEdited({ column }: { column: EditColumnPayload['column'] }) {
    return this.columnEdits[column.tableName]?.[column.originalName]?.name;
  }

  renderColumnNullable({ column }: { column: EditColumnPayload['column'] }) {
    return this.columnEdits[column.tableName]?.[column.originalName]?.nullable ?? column.nullable;
  }

  renderColumnUnique({ column }: { column: EditColumnPayload['column'] }) {
    return this.columnEdits[column.tableName]?.[column.originalName]?.unique ?? column.unique;
  }

  renderColumnMessage({ column }: { column: EditColumnPayload['column'] }) {
    const maybeNewColumnName = this.renderColumnNameEdited({ column });
    const isColumnDeleted = Object.entries(this.columnDeletions)
      .filter((entry) => entry[0] === column.tableName)
      .find((entry) => entry[1].includes(column.originalName));
    const isTableDeleted = this.tableDeletions.find(({ name }) => name === column.tableName);

    const displayUnique = () => {
      const currentUniqueValue = this.renderColumnUnique({ column });
      if (currentUniqueValue !== column.unique) {
        return currentUniqueValue ? chalk.green('unique') : chalk.green('not unique');
      }
      return currentUniqueValue ? chalk.gray.italic('unique') : '';
    };

    // todo better names, render versus display not obvious
    const displayNullable = () => {
      const currentNullableValue = this.renderColumnNullable({ column });
      if (currentNullableValue !== column.nullable) {
        return currentNullableValue ? chalk.green('nullable') : chalk.green('not nullable');
      }
      return currentNullableValue ? chalk.gray.italic('nullable') : '';
    };

    const metadata = [
      `${chalk.gray.italic(column.type)}${column.type === 'link' ? ` → ${chalk.gray.italic(column.link?.table)}` : ''}`,
      displayUnique(),
      displayNullable(),
      column.defaultValue ? chalk.gray.italic(`default: ${column.defaultValue}`) : ''
    ]
      .filter(Boolean)
      .join(' ');

    if (isColumnDeleted || isTableDeleted) {
      return `  - ${chalk.red.strikethrough(column.originalName)} (${metadata})`;
    }
    // Checking names are not the same because it is possible only nullable or unique changed
    if (maybeNewColumnName && maybeNewColumnName !== column.originalName) {
      return `  - ${chalk.bold(maybeNewColumnName)} -> ${chalk.yellow.strikethrough(
        column.originalName
      )} (${metadata})`;
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
      return `• ${chalk.bold(this.renderTableNameEdited(originalName) ?? originalName)} -> ${chalk.yellow.strikethrough(
        originalName
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

    const xata = await this.getXataClient();
    const branchDetails = await getBranchDetailsWithPgRoll(xata, { workspace, region, database, branch });
    if (!branchDetails) this.error('Could not get the schema from the current branch');

    if (flags.source) {
      this.warn('Schema source editing is not supported yet. Please run the command without the --source flag.');
      process.exit(0);
    } else {
      this.branchDetails = branchDetails;
      await this.showSchemaEdit();
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
    const existingEntry = Object.entries(this.columnDeletions)
      .filter((entry) => entry[0] === column.tableName)
      .find((entry) => entry[1].includes(column.originalName));
    // todo simplify
    if (existingEntry) {
      const index = existingEntry[1].findIndex((name) => name === column.originalName);
      if (index > -1) {
        this.columnDeletions[column.tableName].splice(index, 1);
      }
    } else {
      if (!this.columnDeletions[column.tableName]) {
        this.columnDeletions[column.tableName] = [column.originalName];
      } else {
        this.columnDeletions[column.tableName].push(column.originalName);
      }
    }
  }

  tableNameAlreadyExists = (value: string) => {
    return this.branchDetails?.schema.tables.find(({ name }) => name === value) ||
      this.tableEdits.find(({ name }) => name === value) ||
      this.tableAdditions.find(({ name }) => name === value)
      ? true
      : false;
  };

  columnNameAlreadyExists = (value: string, column: AddColumnPayload['column']) => {
    // todo simplify
    return this.branchDetails?.schema.tables
      .find(({ name }) => name === column.tableName)
      ?.columns.find(({ name }) => name === value) ||
      this.columnEdits?.[column.tableName]?.[value] ||
      this.columnAdditions?.[column.tableName]?.[value]
      ? true
      : false;
  };

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
          initial: this.renderColumnNameEdited({ column }) ?? column.originalName,
          validate: (value: string, state: ValidationState) => {
            if (column.originalName === value || value === state.values.name) return true;
            return (
              !emptyString(value) && !this.columnNameAlreadyExists(value, column) && !isReservedXataFieldName(value)
            );
          }
        },
        {
          name: 'nullable',
          message: `Whether the column can be null.`,
          initial: this.renderColumnNullable({ column }) ? 'true' : 'false',
          validate: (value: string) => {
            if (parseBoolean(value) === undefined) return 'Invalid value. Nullable field must be a boolean';
            return true;
          }
        },
        {
          // todo abstract into function
          name: 'unique',
          message: `Whether the column is unique.`,
          initial: this.renderColumnUnique({ column }) ? 'true' : 'false',
          validate: (value: string) => {
            if (parseBoolean(value) === undefined) return 'Invalid value. Unique field must be a boolean';
            return true;
          }
        }
      ],
      footer: this.footer,
      template
    });

    try {
      const { values } = await snippet.run();
      const existingEntry = this.columnEdits[column.tableName]?.[column.originalName];

      const unchanged =
        column.name === values.name &&
        column.nullable === parseBoolean(values.nullable) &&
        column.unique === parseBoolean(values.unique);

      if (unchanged && existingEntry) {
        delete this.columnEdits[column.tableName][column.originalName];
      } else if (!unchanged && existingEntry) {
        existingEntry.name = values.name;
        existingEntry.nullable = parseBoolean(values.nullable) ?? true;
        existingEntry.unique = parseBoolean(values.unique) ?? false;
      } else {
        if (!this.columnEdits[column.tableName]) this.columnEdits[column.tableName] = {};
        if (!this.columnEdits[column.tableName][column.originalName])
          this.columnEdits[column.tableName][column.originalName] = {} as any;
        this.columnEdits[column.tableName][column.originalName] = {
          name: values.name,
          nullable: parseBoolean(values.nullable) ?? true,
          unique: parseBoolean(values.unique) ?? false,
          type: column.type,
          defaultValue: column.defaultValue,
          originalName: column.originalName,
          tableName: column.tableName
        };
      }
      await this.showSchemaEdit();
    } catch (err) {
      if (err) throw err;
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
          validate: (value: string) => {
            if (value === undefined) return 'Name cannot be undefined';
            if (emptyString(value)) return 'Name cannot be empty';
            if (this.columnNameAlreadyExists(value, column)) return 'Column already exists';
            return !isReservedXataFieldName(value);
          }
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
          validate: (value: string) => {
            if (parseBoolean(value) === undefined) return 'Invalid value. Nullable field must be a boolean';
            return true;
          }
        },
        {
          name: 'unique',
          message: `Whether the column is unique.`,
          validate: (value: string) => {
            if (parseBoolean(value) === undefined) return 'Invalid value. Unique field must be a boolean';
            return true;
          }
        },
        {
          name: 'default',
          message: `The default for the column.`,
          validate: (value: string) => {
            return true;
          }
        },
        {
          name: 'link',
          message: 'Linked table. Only required for columns that are links. Will be ignored if type is not link.',
          validate: (value: string, state: ValidationState) => {
            const columnType = state.items.find(({ name }) => name === 'type')?.input;
            if ((value === undefined || emptyString(value)) && columnType === 'link')
              return 'Cannot be empty string when the type is link';
            if (columnType === 'link' && !this.tableNameAlreadyExists(value)) return 'Table does not exist';
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
      this.columnAdditions[tableName][values.name] = {
        tableName,
        originalName: values.name,
        name: values.name,
        type: values.type,
        nullable: parseBoolean(values.nullable) ?? true,
        unique: parseBoolean(values.unique) ?? false,
        defaultValue: values.default,
        link: values.link ? { table: values.link } : undefined,
        vector: values.vectorDimension ? { dimension: values.vectorDimension } : undefined,
        file:
          values.type === 'file' && values.defaultPublicAccess
            ? { defaultPublicAccess: values.defaultPublicAccess }
            : undefined,
        'file[]':
          values.type === 'file[]' && values.defaultPublicAccess
            ? { defaultPublicAccess: values.defaultPublicAccess }
            : undefined
      };

      await this.showSchemaEdit();
    } catch (err) {
      if (err) throw err;
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
          validate: (value: string) => {
            if (emptyString(value)) return 'Name cannot be empty';
            return !isReservedXataFieldName(value) && !this.tableNameAlreadyExists(value);
          }
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
      await this.showSchemaEdit();
    } catch (err) {
      if (err) throw err;
    }
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
          validate: (value: string, state: ValidationState) => {
            if (value === state.values.name) return true;
            return !emptyString(value) && !isReservedXataFieldName(value) && !this.tableNameAlreadyExists(value);
          }
        }
      ],
      footer: this.footer,
      template: `
         Name: \${name}
         `
    });

    try {
      const answer: { values: { name: string } } = await snippet.run();

      // todo abstract into a function
      if (answer.values.name !== initialTableName) {
        const existingEntry = this.tableEdits.find(({ name }) => name === initialTableName);
        if (existingEntry) {
          existingEntry.newName = answer.values.name;
        } else {
          this.tableEdits.push({ name: initialTableName, newName: answer.values.name });
        }
      } else {
        const index = this.tableEdits.findIndex(({ name }) => name === initialTableName);
        if (index > -1) {
          this.tableEdits.splice(index, 1);
        }
      }
      await this.showSchemaEdit();
    } catch (err) {
      if (err) throw err;
    }
  }
}

const editTableDisabled = (name: string, tableDeletions: DeleteTablePayload[]) => {
  return tableDeletions.some(({ name: tableName }) => tableName === name) ? true : false;
};

/** Necessary because disabling prevents the user from "undeleting" a column */
const editColumnDisabled = (column: EditColumnPayload['column'], columnDeletions: DeleteColumnPayload) => {
  return columnDeletions[column.tableName]?.includes(column.originalName) ? true : false;
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
  // todo better way to deep copy? If not surround with try catch

  let localTableAdditions: (AddTablePayload['table'] & { columns?: AddColumnPayload['column'][] })[] = JSON.parse(
    JSON.stringify(command.tableAdditions)
  );
  let localTableEdits: EditTablePayload['table'][] = JSON.parse(JSON.stringify(command.tableEdits));
  let localTableDeletions: DeleteTablePayload[] = JSON.parse(JSON.stringify(command.tableDeletions));
  const localColumnAdditions: ColumnAdditionData = JSON.parse(JSON.stringify(command.columnAdditions));
  const localColumnEdits: ColumnEditData = JSON.parse(JSON.stringify(command.columnEdits));
  const localColumnDeletions: DeleteColumnPayload = JSON.parse(JSON.stringify(command.columnDeletions));

  const isTableDeleted = (name: string) => {
    return localTableDeletions.find(({ name: tableName }) => tableName === name);
  };

  // Remove column edits, additions and deletions for tables that are deleted
  for (const [tableName, _] of Object.entries({
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

  // if column was deleted then remove edits, and additions and deletions if new
  for (const [tableName, columns] of Object.entries(localColumnDeletions)) {
    for (const columnName of columns) {
      const columnWasEdited = localColumnEdits[tableName]?.[columnName];
      if (columnWasEdited) {
        // remove the edit
        delete localColumnEdits[tableName][columnName];
      }
      const columnWasAdded = localColumnAdditions[tableName]?.[columnName];
      if (columnWasAdded) {
        // remove deletions
        localColumnDeletions[tableName] = localColumnDeletions[tableName].filter((col) => col !== columnName);
        // remove the addition
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
    if (edit) {
      return {
        name: edit.newName
      };
    }
    return addition;
  });

  // bundle edit columns into new columns
  for (const [tableName, columns] of Object.entries(localColumnEdits)) {
    // TODO multiple edits are not being bundled into one
    for (const [columnName, column] of Object.entries(columns)) {
      const columnIsNew = localColumnAdditions[tableName]?.[columnName];
      if (columnIsNew) {
        // add to column additions
        localColumnAdditions[tableName][columnName] = {
          ...column,
          name: column.name,
          unique: column.unique ?? false,
          nullable: column.nullable ?? true
        };
        // delete column from edits
        delete localColumnEdits[tableName][columnName];
        if (Object.keys(localColumnEdits[tableName]).length === 0) {
          delete localColumnEdits[tableName];
        }
      }
    }
  }

  // console.log("are edits bundled into one", localColumnEdits)
  // bundle new columns into new tables
  for (const [tableName, columns] of Object.entries(localColumnAdditions)) {
    console.log('columns in localColumn additions', tableName, columns);
    const tableIsNew = localTableAdditions.find((addition) => addition.name === tableName);
    if (tableIsNew) {
      for (const [columnName, column] of Object.entries(columns)) {
        const localTableAddition = localTableAdditions.find((addition) => addition.name === tableName);
        console.log('local table edition', localTableAddition);
        if (localTableAddition) {
          if (!localTableAddition?.columns) localTableAddition.columns = [];
          // add to table additions
          localTableAddition?.columns.push(column);
          console.log('pushign column into tableaddition', column, localTableAddition);
        }

        // delete from column additions
        delete localColumnAdditions[tableName][columnName];
      }
      delete localColumnAdditions[tableName];
    }
  }
  // console.log("local column additions", localTableAdditions)

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
      ...augmentColumns(Object.values(columns)).map(({ column, tableName }) => {
        return {
          add_column: {
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
        columns: augmentColumns(columns ?? []).map(({ column }) => column)
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

  const columnEdits: { alter_column: OpAlterColumn }[] = [];
  for (const [_, columns] of Object.entries(localColumnEdits)) {
    for (const [_, data] of Object.entries(columns)) {
      const { name, nullable, unique, type, link, originalName } = data;
      const cols = augmentColumns([data]).map(({ column, tableName }) => {
        return {
          alter_column: {
            column: originalName,
            table: tableName,
            nullable,
            unique: !unique
              ? undefined
              : {
                  name: `unique_constraint_${tableName}_${name}`
                },
            name,
            references: type === 'link' ? generateLinkReference({ column: name, table: link?.table ?? '' }) : undefined,
            // todo if just a rename, no up and down required
            // todo if notnull changes - notNullUpValue needs to be called
            up: `"${name}"`,
            down: `"${name}"`
          }
        };
      });
      columnEdits.push(...cols);
    }
  }

  return [...columnDeletions, ...tableDeletions, ...tableAdditions, ...columnAdditions, ...columnEdits, ...tableEdits];
};

// todo add to pgroll file?
const augmentColumns = (
  columns: AddColumnPayload['column'][]
): { column: OpAddColumn['column']; tableName: string }[] => {
  return columns.map((column) => ({
    tableName: column.tableName,
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
      comment: xataColumnTypeToPgRollComment(column as any),
      up: requiresUpArgument(column.nullable === false, column.defaultValue)
        ? xataColumnTypeToZeroValue(column.type as any, column.defaultValue)
        : undefined
    }
  }));
};

async function waitForMigrationToFinish(
  api: XataApiClient,
  workspace: string,
  region: string,
  database: string,
  branch: string,
  jobId: string
): Promise<void> {
  const { status, error } = await api.migrations.getMigrationJobStatus({
    pathParams: { workspace, region, dbBranchName: `${database}:${branch}`, jobId }
  });
  if (status === 'failed') {
    throw new Error(`Migration failed, ${error}`);
  }

  if (status === 'completed') {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));
  return await waitForMigrationToFinish(api, workspace, region, database, branch, jobId);
}

const isReservedXataFieldName = (name: string) => {
  return name.toLowerCase().startsWith('xata_');
};

// todo add to helpers file?
function parseBoolean(value?: string) {
  if (!value) return undefined;
  const val = value.toLowerCase();
  if (['true', 't', '1', 'y', 'yes'].includes(val)) return true;
  if (['false', 'f', '0', 'n', 'no'].includes(val)) return false;
}

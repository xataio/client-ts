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
  DeleteColumnPayload,
  DeleteTablePayload,
  EditColumnPayload,
  EditTablePayload,
  SelectChoice
} from './types.js';
import { getBranchDetailsWithPgRoll } from '../../migrations/pgroll.js';

const { Select, Snippet, Confirm } = enquirer as any;

const uniqueUnsupportedTypes = ['text', 'multiple', 'vector', 'json'];
const defaultValueUnsupportedTypes = ['multiple', 'link', 'vector'];
const notNullUnsupportedTypes = defaultValueUnsupportedTypes;

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
  columnAdditions: AddColumnPayload['column'][] = [];
  columnEdits: EditColumnPayload['column'][] = [];
  columnDeletions: DeleteColumnPayload = {};

  currentMigration: PgRollMigration = { operations: [] };

  activeIndex: number = 0;

  async showSchemaEdit() {
    const tableChoices: SelectChoice[] = [];
    const schemaChoice: SelectChoice = {
      name: { type: 'schema' },
      message: 'Tables',
      role: 'heading',
      choices: tableChoices
    };

    const tablesToLoop = [
      ...this.branchDetails!.schema.tables,
      ...this.tableAdditions.map((addition) => ({
        name: addition.name,
        columns: []
      }))
    ];
    for (const table of tablesToLoop) {
      const columnChoices: SelectChoice[] = [];
      tableChoices.push({
        name: { type: 'edit-table', table: { name: table.name, newName: table.name } },
        message: this.renderTableName(table.name),
        choices: columnChoices
      });
      const columns = Object.values(table.columns);
      const choices: SelectChoice[] = columns
        .filter(({ name }) => !isReservedXataFieldName(name))
        .map((column) => {
          const col: EditColumnPayload['column'] = {
            name: column.name,
            unique: column.unique ?? false,
            type: column.type,
            nullable: column.notNull ?? true,
            tableName: table.name,
            originalName: column.name,
            defaultValue: column.defaultValue ?? undefined,
            vectorDimension: column.vector ? column.vector.dimension : undefined,
            link: column.type === 'link' && column.link?.table ? { table: column.link.table } : undefined
          };
          const item: SelectChoice = {
            name: {
              type: 'edit-column',
              column: col
            },
            message: this.renderColumnName({ column: col }),
            disabled: editTableDisabled(table.name, this.tableDeletions)
          };
          return item;
        });

      const newColumns: SelectChoice[] = [];
      for (const addition of this.columnAdditions.filter((addition) => addition.tableName === table.name)) {
        // todo fix type
        const formatted = { ...addition, tableName: table.name, originalName: addition.name } as any;
        newColumns.push({
          name: { type: 'edit-column', column: formatted },
          message: this.renderColumnName({ column: formatted }),
          disabled: editTableDisabled(table.name, this.tableDeletions)
        });
      }

      columnChoices.push(...choices, ...newColumns, {
        name: {
          type: 'add-column',
          tableName: table.name,
          column: { originalName: '', tableName: table.name, name: '', type: 'string', unique: false, nullable: false }
        },
        message: `${chalk.green('+')} Add a column`,
        disabled: editTableDisabled(table.name, this.tableDeletions),
        hint: 'Add a column to a table'
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

    const select = new Select({
      message: 'Schema for database test:main',
      initial: this.activeIndex,
      choices: [schemaChoice],
      footer:
        'Use the ↑ ↓ arrows to move across the schema, enter to edit or add things, delete or backspace to delete things.'
    });

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
        // todo exhaustive check
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
      // TODO run migration
    } else {
      this.logJson(this.currentMigration);
      this.toErrorJson('Migration is invalid:' + valid.error.errors.flatMap((e) => e.message).join('\n'));
    }
  }

  renderColumnName({ column }: { column: EditColumnPayload['column'] }) {
    const columnEdit = this.columnEdits
      .filter((edit) => edit.tableName === column.tableName)
      .find(({ originalName: editName }) => editName === column.originalName);
    const columnDelete = Object.entries(this.columnDeletions)
      .filter((entry) => entry[0] === column.tableName)
      .find((entry) => entry[1].includes(column.originalName));
    const tableDelete = this.tableDeletions.find(({ name }) => name === column.tableName);

    const metadata = [
      `${chalk.gray.italic(column.type)}${column.type === 'link' ? ` → ${chalk.gray.italic(column.link?.table)}` : ''}`,
      column.unique ? chalk.gray.italic('unique') : '',
      column.nullable ? chalk.gray.italic('not null') : '',
      column.defaultValue ? chalk.gray.italic(`default: ${column.defaultValue}`) : ''
    ]
      .filter(Boolean)
      .join(' ');

    if (columnDelete || tableDelete) {
      return `  - ${chalk.red.strikethrough(column.originalName)} (${metadata})`;
    }
    if (columnEdit) {
      return `  - ${chalk.bold(columnEdit.name)} -> ${chalk.yellow.strikethrough(column.originalName)} (${metadata})`;
    }
    return `- ${chalk.cyan(column.originalName)} (${metadata})`;
  }

  renderTableName(originalName: string, newTable: boolean = false) {
    const tableEdit = this.tableEdits.find(({ name }) => name === originalName);
    const tableDelete = this.tableDeletions.find(({ name }) => name === originalName);
    if (tableDelete) {
      return `• ${chalk.red.strikethrough(originalName)}`;
    }
    if (tableEdit) {
      return `• ${chalk.bold(tableEdit.newName)} -> ${chalk.yellow.strikethrough(originalName)}`;
    }
    return newTable ? `• ${chalk.bold(originalName)}` : `• ${chalk.bold(originalName)}`;
  }

  async run(): Promise<void> {
    const { flags } = await this.parseCommand();

    if (flags.source) {
      this.warn(
        `This way of editing the schema doesn't detect renames of tables or columns. They are interpreted as deleting/adding tables and columns.
Beware that this can lead to ${chalk.bold(
          'data loss'
        )}. Other ways of editing the schema that do not have this limitation are:
* run the command without ${chalk.bold('--source')}
* edit the schema in the Web UI. Use ${chalk.bold('xata browse')} to open the Web UI in your browser.`
      );
      this.log();
    }

    const { workspace, region, database, branch } = await this.getParsedDatabaseURLWithBranch(flags.db, flags.branch);
    this.workspace = workspace;
    this.region = region;
    this.database = database;
    this.branch = branch;

    const xata = await this.getXataClient();
    const branchDetails = await getBranchDetailsWithPgRoll(xata, { workspace, region, database, branch });
    if (!branchDetails) this.error('Could not get the schema from the current branch');

    if (flags.source) {
      // todo implement editor
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
  tableNameField = {
    name: 'name',
    message: 'The table name',
    validate(value: string) {
      // TODO make sure no other tables have this name
      return notEmptyString(value);
    }
  };

  noExistingColumnName = (value: string, column: AddColumnPayload['column']) => {
    return !this.columnEdits.find(({ name, tableName }) => tableName === column.tableName && name === value) ||
      !this.columnAdditions.find(({ name, tableName }) => tableName === column.tableName && name === value)
      ? true
      : 'Column name conflicts with another one in the same table';
  };

  async toggleTableDelete({ initialTableName }: { initialTableName: string }) {
    const existingEntry = this.tableDeletions.find(({ name }) => name === initialTableName);
    if (existingEntry) {
      const index = this.tableDeletions.findIndex(({ name }) => name === initialTableName);
      if (index > -1) {
        this.tableDeletions.splice(index, 1);
      }
    } else {
      this.tableDeletions.push({ name: initialTableName });
    }
  }

  async toggleColumnDelete({ column }: { column: EditColumnPayload['column'] }) {
    const existingEntry = Object.entries(this.columnDeletions)
      .filter((entry) => entry[0] === column.tableName)
      .find((entry) => entry[1].includes(column.originalName));
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

  async showColumnEdit(column: EditColumnPayload['column']) {
    const uniqueObject = column.unique ? { name: `unique_constraint_${column.originalName}` } : undefined;
    const alterColumnDefaultValues: { alter_column: OpAlterColumn } = {
      alter_column: {
        name: column.name,
        column: column.originalName,
        table: column.tableName,
        nullable: !notNullUnsupportedTypes.includes(column.type) ? column.nullable : undefined,
        unique: !uniqueUnsupportedTypes.includes(column.type) ? (column.unique ? uniqueObject : undefined) : undefined
        // TODO support default https://github.com/xataio/pgroll/issues/327
        // TODO support changing type https://github.com/xataio/pgroll/issues/328
      }
    };
    this.clear();
    const template = `
  {
    alter_column: {
      name: \${name},
      column: ${column.originalName},
      ${!notNullUnsupportedTypes.includes(column.type) ? `nullable: \${nullable},` : ''}
      ${!uniqueUnsupportedTypes.includes(column.type) ? `unique: \${unique},` : ''}
    }
  }
}`;

    const snippet = new Snippet({
      message: 'Edit a column',
      initial: alterColumnDefaultValues,
      fields: [
        {
          name: 'name',
          message: alterColumnDefaultValues.alter_column.column,
          initial: alterColumnDefaultValues.alter_column.column,
          validate: (value: string) => {
            if (column.originalName === value) return true;
            return notEmptyString(value) && this.noExistingColumnName(value, column) && !isReservedXataFieldName(value);
          }
        },
        {
          name: 'nullable',
          message: alterColumnDefaultValues.alter_column.nullable ? 'false' : 'true',
          initial: alterColumnDefaultValues.alter_column.nullable ? 'false' : 'true',
          validate: (value: string) => {
            return value !== 'false' && value !== 'true' ? 'Invalid value. Nullable field must be a boolean' : true;
          }
        },
        {
          name: 'unique',
          message: alterColumnDefaultValues.alter_column.unique ? JSON.stringify(uniqueObject) : 'undefined',
          initial: alterColumnDefaultValues.alter_column.unique ? JSON.stringify(uniqueObject) : 'undefined',
          validate: (value: string) => {
            if (value === 'undefined') return true;
            const errorMessage =
              'Invalid value. Unique field must be in the form of { "name": "unique_name_for_constraint" }';
            try {
              const v = JSON.parse(value);
              if (v && v.name) {
                return true;
              }
              throw errorMessage;
            } catch (e) {
              return errorMessage;
            }
          }
        }
      ],
      footer: this.footer,
      template
    });

    try {
      const { values } = await snippet.run();
      const existingEntry = this.columnEdits.find(
        ({ originalName, tableName }) => tableName === column.tableName && originalName === column.originalName
      );
      console.log('VALUES UNIQUE', values);
      if (existingEntry) {
        // todo only add to edits if it changed from original
        existingEntry.name = values.name;
        (existingEntry.nullable = values.notNull === undefined || values.notNull === false ? true : false),
          (existingEntry.unique = values.unique);
      } else {
        this.columnEdits.push({
          // todo only add to edits if it changed from original
          name: values.name,
          defaultValue: column.defaultValue,
          type: column.type,
          nullable: values.notNull === undefined || values.notNull === false ? true : false,
          unique: values.unique,
          originalName: column.originalName,
          tableName: column.tableName
        });
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

    const addColumnDefault: { add_column: OpAddColumn } = {
      add_column: {
        column: {
          name: column.originalName,
          nullable: !notNullUnsupportedTypes.includes(column.type) ? column.nullable : undefined,
          unique: !uniqueUnsupportedTypes.includes(column.type) ? false : undefined,
          type: column.type,
          default: defaultValueUnsupportedTypes.includes(column.type) ? column.defaultValue : undefined
        },
        table: column.tableName

        // TODO support default https://github.com/xataio/pgroll/issues/327
        // TODO support changing type https://github.com/xataio/pgroll/issues/328
      }
    };

    // TODO add reference if link is chosen as type
    const template = `
  {
    add_column: {
      column: {
        name: \${name},
        nullable: \${nullable},
        unique: \${unique},
        type: \${type},
        defaultValue: \${defaultValue}
      },
      table: ${tableName}
    }
  }
}`;

    const snippet = new Snippet({
      message: 'Add a column',
      fields: [
        {
          name: 'name',
          message: addColumnDefault.add_column.column.name,
          initial: addColumnDefault.add_column.column.name,
          validate: (value: string) => {
            if (column.originalName === value) return true;
            return notEmptyString(value) && this.noExistingColumnName(value, column) && !isReservedXataFieldName(value);
          }
        },
        {
          name: 'nullable',
          message: addColumnDefault.add_column.column.nullable ? 'false' : 'true',
          initial: addColumnDefault.add_column.column.nullable ? 'false' : 'true',
          validate: (value: string) => {
            // todo check if the type supports nullable otherwise return error
            return value !== 'false' && value !== 'true' ? 'Invalid value. Nullable field must be a boolean' : true;
          }
        },
        {
          name: 'unique',
          message: addColumnDefault.add_column.column.unique ? 'false' : 'true',
          initial: addColumnDefault.add_column.column.unique ? 'false' : 'true',
          validate: (value: string) => {
            // todo check if the type supports unique otherwise return error
            return value !== 'false' && value !== 'true' ? 'Invalid value. Unique field must be a boolean' : true;
          }
        },
        {
          name: 'default',
          message: addColumnDefault.add_column.column.default
            ? addColumnDefault.add_column.column.default
            : 'undefined',
          initial: addColumnDefault.add_column.column.default
            ? addColumnDefault.add_column.column.default
            : 'undefined',
          validate: (value: string) => {
            // todo check if the type supports default otherwise return error
            return true;
          }
        }
      ],
      footer: this.footer,
      template
    });
    try {
      const { values } = await snippet.run();

      this.columnAdditions.push({
        name: values.name,
        defaultValue: values.defaultValue,
        type: values.type,
        nullable: values.notNull === undefined || values.notNull === false ? true : false,
        unique: values.unique,
        tableName,
        originalName: values.name
      });
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
      fields: [this.tableNameField],
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
      initial: { name: initialTableName },
      fields: [this.tableNameField],

      // TODO name cannot be empty
      // TODO name cannot be already taken
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

const notEmptyString = (value: string) => {
  return value !== '' ? true : 'Name cannot be empty';
};

const createSpace = (): SelectChoice => {
  return { name: { type: 'space' }, message: ' ', role: 'heading' };
};

export const editsToMigrations = (command: EditSchema) => {
  // Duplicating here because if we remove items from class state they dont show on UI
  let localTableAdditions: (AddTablePayload['table'] & { columns?: AddColumnPayload['column'][] })[] =
    command.tableAdditions;
  let localTableEdits: EditTablePayload['table'][] = command.tableEdits;
  const localTableDeletions: DeleteTablePayload[] = command.tableDeletions;
  let localColumnAdditions: AddColumnPayload['column'][] = command.columnAdditions;
  let localColumnEdits: EditColumnPayload['column'][] = command.columnEdits;
  let localColumnDeletions: DeleteColumnPayload = command.columnDeletions;

  const tmpColumnAddition = [...localColumnAdditions];
  localColumnAdditions = localColumnAdditions.filter(
    (addition) => !localColumnDeletions[addition.tableName]?.includes(addition.originalName)
  );
  localColumnEdits = localColumnEdits.filter(
    (edit) => !localColumnDeletions[edit.tableName]?.includes(edit.originalName)
  );
  localColumnDeletions = Object.fromEntries(
    Object.entries(localColumnDeletions).filter(
      (entry) => !tmpColumnAddition.find((addition) => addition.tableName === entry[0])
    )
  );

  localTableAdditions = localTableAdditions.filter(
    ({ name }) => !localTableDeletions.find(({ name: tableName }) => tableName === name)
  );
  localTableEdits = localTableEdits.filter(
    ({ name }) => !localTableDeletions.find(({ name: tableName }) => tableName === name)
  );
  localColumnAdditions = localColumnAdditions.filter(
    ({ tableName }) => !localTableDeletions.find(({ name }) => name === tableName)
  );
  localColumnEdits = localColumnEdits.filter(
    ({ tableName }) => !localTableDeletions.find(({ name }) => name === tableName)
  );
  localColumnDeletions = Object.fromEntries(
    Object.entries(localColumnDeletions).filter(
      ([tableName]) => !localTableDeletions.find(({ name }) => name === tableName)
    )
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
  const editsToNewColumn = localColumnEdits.filter(({ originalName }) =>
    localColumnAdditions.find((addition) => addition.name === originalName)
  );
  localColumnEdits = localColumnEdits.filter(
    ({ originalName }) => !editsToNewColumn.find((edit) => edit.originalName === originalName)
  );
  localColumnAdditions = localColumnAdditions.map((addition) => {
    const edit = editsToNewColumn.find(({ originalName }) => originalName === addition.name);
    if (edit) {
      return {
        ...addition,
        name: edit.name
      };
    }
    return addition;
  });

  // todo edit column additions
  // add_column: {
  //   table,
  //   up: requiresUpArgument(notNull, defaultValue)
  //     ? xataColumnTypeToZeroValue(column.type, defaultValue)
  //     : undefined,
  //   column: {
  //     name: column.name,
  //     type: xataColumnTypeToPgRoll(column.type),
  //     references:
  //       column.type === 'link'
  //         ? generateLinkReference({ column: column.name, table: linkTable, onDelete: linkOnDelete })
  //         : undefined,
  //     default: defaultValue !== null && defaultValue !== undefined ? `'${defaultValue}'` : undefined,
  //     nullable: !notNull,
  //     unique: unique,
  //     check: xataColumnTypeToPgRollConstraint(column, table),
  //     comment: xataColumnTypeToPgRollComment(column)
  //   }
  // }

  // bundle new columns into create_tables
  const columnAdditionsToNewTables = localColumnAdditions.filter(({ tableName }) =>
    localTableAdditions.find(({ name }) => name === tableName)
  );
  localColumnAdditions = localColumnAdditions.filter(
    ({ tableName }) => !columnAdditionsToNewTables.find((addition) => addition.tableName === tableName)
  );
  localTableAdditions = localTableAdditions.map((addition) => {
    const columns = columnAdditionsToNewTables
      .filter((column) => column.tableName === addition.name)
      .map((column) => {
        return {
          name: column.name,
          type: column.type,
          nullable: column.nullable,
          unique: column.unique,
          defaultValue: column.defaultValue
        } as AddColumnPayload['column'];
      });
    return {
      ...addition,
      columns: columns
    };
  });

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

  const columnAdditions: { add_column: OpAddColumn }[] = localColumnAdditions.map(
    ({ name, tableName, type, nullable, unique, defaultValue }) => {
      return {
        add_column: {
          column: {
            name,
            type,
            nullable,
            unique: unique as boolean,
            defaultValue
          },
          table: tableName
        }
      };
    }
  );

  const tableAdditions: { create_table: OpCreateTable }[] = localTableAdditions.map(({ name, columns }) => {
    return {
      create_table: {
        name: name,
        columns: columns as any
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

  const columnEdits: { alter_column: OpAlterColumn }[] = localColumnEdits.map(
    ({ originalName, tableName, name, nullable, unique }) => {
      const edit: { alter_column: OpAlterColumn } = {
        alter_column: {
          column: originalName,
          table: tableName,
          nullable,
          unique: unique as { name: string },
          name
          // TODO populate up and down
        }
      };
      return edit;
    }
  );

  return [...columnDeletions, ...tableDeletions, ...tableAdditions, ...columnAdditions, ...columnEdits, ...tableEdits];
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

/* eslint-disable @typescript-eslint/no-unused-vars */
import { getBranchDetails, Schemas } from '@xata.io/client';
import chalk from 'chalk';
import clipboardy from 'clipboardy';
import enquirer from 'enquirer';
import { BaseCommand } from '../../base.js';
import Codegen from '../codegen/index.js';

// The enquirer library has type definitions but they are very poor
const { Select, Snippet, Confirm } = enquirer as any;

type Schema = Awaited<ReturnType<typeof getBranchDetails>>['schema'];
type Table = Schema['tables'][0];
type Column = Table['columns'][0];

type EditableColumn = Column & {
  added?: boolean;
  deleted?: boolean;
  initialName?: string;
  description?: string;
};

type EditableTable = Table & {
  added?: string;
  deleted?: boolean;
  initialName?: string;
  columns: EditableColumn[];
};

const types = ['string', 'int', 'float', 'bool', 'text', 'multiple', 'link', 'email', 'datetime'];
const typesList = types.join(', ');
const identifier = /^[a-zA-Z0-9-_~]+$/;

type SelectChoice = {
  name:
    | {
        type: 'space' | 'schema' | 'add-table' | 'migrate';
      }
    | {
        type: 'add-column' | 'edit-table';
        table: EditableTable;
      }
    | {
        type: 'edit-column';
        table: EditableTable;
        column: EditableColumn;
      };
  message: string;
  role?: string;
  choices?: SelectChoice[];
  disabled?: boolean;
  hint?: string;
};

export default class EditSchema extends BaseCommand {
  static description = 'Edit the schema of the current database';

  static examples = [];

  static flags = {
    ...this.databaseURLFlag,
    branch: this.branchFlag
  };

  static args = [];

  branchDetails: Schemas.DBBranch | undefined;
  tables: EditableTable[] = [];
  workspace!: string;
  database!: string;

  selectItem: EditableColumn | EditableTable | null = null;

  async run(): Promise<void> {
    const { flags } = await this.parse(EditSchema);
    const { workspace, database, branch } = await this.getParsedDatabaseURLWithBranch(flags.db, flags.branch);
    this.workspace = workspace;
    this.database = database;

    const xata = await this.getXataClient();
    this.branchDetails = await xata.branches.getBranchDetails(workspace, database, branch);
    if (!this.branchDetails) this.error('Could not get the schema from the current branch');
    this.tables = this.branchDetails.schema.tables;
    await this.showSchema();
  }

  async showSchema() {
    this.clear();

    const choices: SelectChoice[] = [
      this.createSpace() // empty space
    ];
    const flatChoices = [...choices];

    const tableChoices: SelectChoice[] = [];
    const schema: SelectChoice = {
      name: { type: 'schema' },
      message: 'Tables',
      role: 'heading',
      choices: tableChoices
    };
    choices.push(schema);
    flatChoices.push(schema);

    let index = 0;
    for (const table of this.tables) {
      const columnChoices: SelectChoice[] = table.columns.map((column, i) => {
        if (this.selectItem === column) index = flatChoices.length + i + 1;
        return {
          name: { type: 'edit-column', column, table },
          message: this.getMessageForColumn(table, column)
        };
      });
      columnChoices.push({
        message: `${chalk.green('+')} Add a column`,
        name: { type: 'add-column', table },
        disabled: table.deleted
      });
      const tableChoice: SelectChoice = {
        name: { type: 'edit-table', table },
        message: this.getMessageForTable(table),
        choices: columnChoices
      };
      tableChoices.push(tableChoice);
      if (this.selectItem === table) index = flatChoices.length;
      flatChoices.push(tableChoice);
      flatChoices.push(...columnChoices);
      tableChoices.push(this.createSpace());
      flatChoices.push(this.createSpace());
    }

    choices.push({ message: `${chalk.green('+')} Add a table`, name: { type: 'add-table' } });
    choices.push(this.createSpace());

    const overview = this.getOverview();
    choices.push({
      message: `${chalk.green('►')} Run migration${overview ? ':' : ''}`,
      name: { type: 'migrate' },
      disabled: !overview,
      hint: overview || 'No changes made so far'
    });
    choices.push(this.createSpace());

    const select = new Select({
      message: 'Schema for database test:main',
      initial: index,
      choices,
      footer:
        'Use the ↑ ↓ arrows to move across the schema, enter to edit or add things, delete or backspace to delete things.'
    });
    select.on('keypress', async (char: string, key: { name: string; action: string }) => {
      const flatChoice = flatChoices[select.state.index];
      try {
        if (key.action === 'paste') {
          if (!flatChoice) return;

          if (flatChoice.name.type == 'schema') {
            try {
              const data = JSON.parse(clipboardy.readSync());
              // TODO: validate that it's a table
              data.added = true;
              this.tables.push(data);
              this.selectItem = data;
            } catch (err) {
              if (!(err instanceof SyntaxError)) throw err;
            }
          } else if (flatChoice.name.type === 'edit-table') {
            const table = flatChoice.name.table;
            try {
              const data = JSON.parse(clipboardy.readSync());
              // TODO: validate that it's a table
              data.added = true;
              table.columns.push(data);
              this.selectItem = data;
            } catch (err) {
              if (!(err instanceof SyntaxError)) throw err;
            }
          } else {
            return;
          }

          await select.cancel();
          await this.showSchema();
        } else if (key.name === 'backspace' || key.name === 'delete') {
          if (!flatChoice) return; // add table is not here for example
          const choice = flatChoice.name;
          if (typeof choice !== 'object') return;

          if (choice.type === 'edit-table') {
            await select.cancel();
            await this.deleteTable(choice.table);
          } else if (choice.type === 'edit-column' && !choice.table.deleted) {
            await select.cancel();
            await this.deleteColumn(choice.column, choice.table);
          }
        }
      } catch (err) {
        if (err) throw err;
        this.clear();
      }
    });

    try {
      const result = await select.run();

      if (result.type === 'edit-column') {
        await this.showColumnEdit(result.column, result.table);
      } else if (result.type === 'edit-table') {
        await this.showTableEdit(result.table);
      } else if (result.type === 'add-column') {
        await this.showColumnEdit(null, result.table);
      } else if (result.type === 'add-table') {
        await this.showTableEdit(null);
      } else if (result.type === 'delete-table') {
        await this.deleteTable(result.table);
      } else if (result.type === 'migrate') {
        await this.migrate();
        await Codegen.runIfConfigured(this.projectConfig);
        process.exit(0);
      }
    } catch (err) {
      if (err) throw err;
      // if not, user cancelled
    }

    this.clear();
  }

  createSpace(): SelectChoice {
    return { name: { type: 'space' }, message: ' ', role: 'heading' };
  }

  getMessageForTable(table: EditableTable) {
    if (table.deleted) return `• ${chalk.red.strikethrough(table.name)}`;
    if (table.added) return `• ${chalk.green(table.name)}`;
    if (table.initialName) return `• ${chalk.bold(table.name)} ${chalk.yellow.strikethrough(table.initialName)}`;
    return `• ${chalk.bold(table.name)}`;
  }

  getMessageForColumn(table: EditableTable, column: EditableColumn) {
    const linkedTable = this.tables.find((t) => (t.initialName || t.name) === column.link?.table);
    function getType() {
      if (!linkedTable) return `(${chalk.gray.italic(column.type)})`;
      return `(${chalk.gray.italic(column.type)} → ${chalk.gray.italic(linkedTable.name)})`;
    }
    const type = getType();
    if (table.deleted || column.deleted || linkedTable?.deleted)
      return `- ${chalk.red.strikethrough(column.name)} ${type}`;
    if (table.added || column.added) return `- ${chalk.green(column.name)} ${type}`;
    if (column.initialName)
      return `- ${chalk.cyan(column.name)} ${chalk.yellow.strikethrough(column.initialName)} ${type}`;
    return `- ${chalk.cyan(column.name)} ${type}`;
  }

  getOverview() {
    const info = {
      tables: { added: 0, deleted: 0, modified: 0 },
      columns: { added: 0, deleted: 0, modified: 0 }
    };
    for (const table of this.tables) {
      if (table.added) info.tables.added++;
      else if (table.deleted) info.tables.deleted++;
      else if (table.initialName) info.tables.modified++;

      for (const column of table.columns) {
        const linkedTable = this.tables.find((t) => (t.initialName || t.name) === column.link?.table);
        if (table.added || column.added) info.columns.added++;
        else if (table.deleted || column.deleted || linkedTable?.deleted) info.columns.deleted++;
        else if (column.initialName) info.columns.modified++;
      }
    }

    const tablesOverview = [
      info.tables.added ? `${chalk.green(`+${info.tables.added}`)}` : null,
      info.tables.deleted ? `${chalk.red(`-${info.tables.deleted}`)}` : null,
      info.tables.modified ? `${chalk.yellow(`·${info.tables.modified}`)}` : null
    ].filter(Boolean);

    const columnsOverview = [
      info.columns.added ? `${chalk.green(`+${info.columns.added}`)}` : null,
      info.columns.deleted ? `${chalk.red(`-${info.columns.deleted}`)}` : null,
      info.columns.modified ? `${chalk.yellow(`·${info.columns.modified}`)}` : null
    ].filter(Boolean);

    const messages = [
      tablesOverview.length > 0 ? `${tablesOverview.join(', ')} tables` : null,
      columnsOverview.length > 0 ? `${columnsOverview.join(', ')} columns` : null
    ].filter(Boolean);

    return messages.join(', ');
  }

  async showColumnEdit(column: EditableColumn | null, table: EditableTable) {
    this.clear();

    type ColumnEditState = {
      values: {
        name?: string;
        type?: string;
        link?: string;
        description?: string;
      };
    };

    const snippet: any = new Snippet({
      message: column?.name || 'a new column',
      initial: {
        name: column?.name || '',
        type: column?.type || '',
        link: column?.link?.table || '',
        description: column?.description || ''
      },
      fields: [
        {
          name: 'name',
          message: 'The column name',
          validate(value: string, state: ColumnEditState, item: unknown, index: number) {
            if (!identifier.test(value || '')) {
              return snippet.styles.danger(`Column name has to match ${identifier}`);
            }
            return true;
          }
        },
        {
          name: 'type',
          message: `The column type (${typesList})`,
          validate(value: string, state: ColumnEditState, item: unknown, index: number) {
            if (!types.includes(value)) {
              return snippet.styles.danger(`Type needs to be one of ${typesList}`);
            }
            return true;
          }
        },
        {
          name: 'link',
          message: 'Linked table. Only for columns that are links',
          validate(value: string, state: ColumnEditState, item: unknown, index: number) {
            if (state.values.type === 'link') {
              if (!value) {
                return snippet.styles.danger('The link field must be filled the columns of type `link`');
              }
            } else if (value) {
              return snippet.styles.danger('The link field must not be filled unless the type of the column is `link`');
            }
            return true;
          }
        },
        {
          name: 'description',
          message: 'An optional column description'
        }
      ],
      footer() {
        return '\nUse the ↑ ↓ arrows to move across fields, enter to submit and escape to cancel.';
      },
      template: `
         Name: \${name}
         Type: \${type}
         Link: \${link}
  Description: \${description}`
    });

    try {
      const { values } = await snippet.run();
      const col: Column = {
        name: values.name,
        type: values.type,
        link: values.link && values.type === 'link' ? { table: values.link } : undefined
        // TODO: add description once the backend supports it
        // description: values.description
      };
      if (column) {
        if (!column.initialName && !column.added && column.name !== values.name) {
          column.initialName = column.name;
        }
        Object.assign(column, col);
        if (column.name === column.initialName) {
          delete column.initialName;
        }
      } else {
        table.columns.push({
          ...col,
          added: true
        });
        // Override the variable to use it when redefining this.selectItem below
        column = table.columns[table.columns.length - 1];
      }
    } catch (err) {
      if (err) throw err;
      // if not, user cancelled
    }

    this.selectItem = column;
    await this.showSchema();
  }

  async showTableEdit(table: EditableTable | null) {
    this.clear();

    const snippet = new Snippet({
      message: table ? table.name : 'a new table',
      initial: {
        name: table ? table.name : ''
      },
      fields: [
        {
          name: 'name',
          message: 'The table name',
          validate(value: string, state: unknown, item: unknown, index: number) {
            if (!identifier.test(value || '')) {
              return snippet.styles.danger(`Table name has to match ${identifier}`);
            }
            return true;
          }
        },
        {
          name: 'description',
          message: 'An optional table description'
        }
      ],
      footer() {
        return '\nUse the ↑ ↓ arrows to move across fields, enter to submit and escape to cancel.';
      },
      template: `
         Name: \${name}
  Description: \${description}`
    });

    try {
      const answer = await snippet.run();
      if (table) {
        if (!table.initialName && !table.added && table.name !== answer.values.name) {
          table.initialName = table.name;
        }
        Object.assign(table, answer.values);
        if (table.name === table.initialName) {
          delete table.initialName;
        }
      } else {
        this.tables.push({
          ...answer.values,
          columns: [],
          added: true
        });
        // Override the variable to use it when redefining this.selectItem below
        table = this.tables[this.tables.length - 1];
      }
    } catch (err) {
      if (err) throw err;
      // if not, user cancelled
    }

    this.selectItem = table;
    await this.showSchema();
  }

  async deleteTable(table: EditableTable) {
    if (table.added) {
      const index = this.tables.indexOf(table);
      this.tables.splice(index, 1);
      // TODO: select other table?
    } else {
      table.deleted = !table.deleted;
      this.selectItem = table;
    }

    this.clear();
    await this.showSchema();
  }

  async deleteColumn(column: EditableColumn, table: EditableTable) {
    if (column.added) {
      const index = table.columns.indexOf(column);
      table.columns.splice(index, 1);
      // TODO: select other column?
      this.selectItem = table;
    } else {
      column.deleted = !column.deleted;
      this.selectItem = column;
    }

    this.clear();
    await this.showSchema();
  }

  clear() {
    process.stdout.write('\x1b[2J');
    process.stdout.write('\x1b[0f');
  }

  async migrate() {
    this.clear();

    if (!this.branchDetails) this.error('Branch details are not available');

    const prompt = new Confirm({
      name: 'question',
      message: `Are you sure you want to run the migration? ${this.getOverview()}`
    });

    try {
      const answer = await prompt.run();
      if (!answer) {
        await this.showSchema();
        return;
      }
    } catch (err) {
      if (err) throw err;
      // User cancelled
      await this.showSchema();
      return;
    }

    const workspace = this.workspace;
    const database = this.database;

    const xata = await this.getXataClient();
    const branch = this.branchDetails.branchName;

    // Create tables, update tables, delete columns and update columns
    for (const table of this.tables) {
      if (table.added) {
        this.log(`Creating table ${table.name}`);
        await xata.tables.createTable(workspace, database, branch, table.name);
      } else if (table.initialName) {
        this.log(`Renaming table ${table.initialName} to ${table.name}`);
        await xata.tables.updateTable(workspace, database, branch, table.initialName, {
          name: table.name
        });
      }

      for (const column of table.columns) {
        const linkedTable = this.tables.find((t) => (t.initialName || t.name) === column.link?.table);
        if (column.deleted || linkedTable?.deleted) {
          this.log(`Deleting column ${table.name}.${column.name}`);
          await xata.tables.deleteColumn(workspace, database, branch, table.name, column.name);
        } else if (column.initialName) {
          this.log(`Renaming column ${table.name}.${column.initialName} to ${table.name}.${column.name}`);
          await xata.tables.updateColumn(workspace, database, branch, table.name, column.initialName, {
            name: column.name
          });
        }
      }
    }

    // Delete tables and create columns
    for (const table of this.tables) {
      if (table.deleted) {
        this.log(`Deleting table ${table.name}`);
        await xata.tables.deleteTable(workspace, database, branch, table.name);
        continue;
      }

      for (const column of table.columns) {
        if (table.added || column.added) {
          await xata.tables.addTableColumn(workspace, database, branch, table.name, {
            name: column.name,
            type: column.type,
            link: column.link
          });
        }
      }
    }

    this.log('Migration completed!');
  }
}

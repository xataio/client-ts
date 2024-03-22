// import { Flags } from "@oclif/core";
// import { BaseCommand } from "../../base";
import { BaseCommand } from '../../base.js';
// import schemas from "@xata.io/pgroll"
import { Flags } from '@oclif/core';
import { Schemas } from '@xata.io/client';
import { PgRollMigration, PgRollMigrationDefinition } from '@xata.io/pgroll';
import chalk from 'chalk';
import enquirer from 'enquirer';
// Add table
// Rename table
// Delete table
// Add column
// Edit column
// Delete column

const currentMigration: PgRollMigration = { operations: [] };

const { Select, Snippet, Confirm } = enquirer as any;

type BranchSchema = Schemas.BranchSchema

type TableAdd = {
  name: string;
  columns: ColumnAdd[];
}

type TableEdit = {
  name: string;
}

type ColumnEdit = {
  name: string;
  unique: boolean;
  nullable: boolean;
}

type ColumnAdd = {
  name: string;
  type: string;
  unique: boolean;
  nullable: boolean;
  default?: string;
  vectorDimension?: string
  link?: string
}

const types = ['string', 'int', 'float', 'bool', 'text', 'multiple', 'link', 'email', 'datetime', 'vector', 'json'];
const typesList = types.join(', ');
const uniqueUnsupportedTypes = ['text', 'multiple', 'vector', 'json'];
const defaultValueUnsupportedTypes = ['multiple', 'link', 'vector'];
const notNullUnsupportedTypes = defaultValueUnsupportedTypes;

type SelectChoice = {
  name:
  | {
      type: 'space' | 'add-table' | 'edit-table' | 'add-column' | 'edit-column';
    }
    | {
      type: 'add-table';
      table: TableAdd
    }
  | {
      type: 'add-column';
      table: TableEdit;
    }
    | {
      type: 'edit-table';
      table: TableEdit;
    }
  | {
      type: 'edit-column';
      column: ColumnEdit;
    };
  message: string;
  role?: string;
  choices?: SelectChoice[];
  disabled?: boolean;
  hint?: string;
}

// Delete will be backspace

const createSpace = (): SelectChoice => {
  return { name: { type: 'space' }, message: ' ', role: 'heading' };
}

const createColumnChoices = (): SelectChoice[] => {
  // TODO all the tables columns
  return [{
    name: { type: 'edit-column', column: {
      name: 'fakecolumn',
      unique: false,
      nullable: true
    }},
    message: `- ${chalk.cyan("Fake Column Name 1")}`,
    hint: 'Edit a column in a table'
  },
  // Always an extra add column
  {
    name: { type: 'add-column' },
    message: `${chalk.green('+')} Add a column`,
    hint: 'Add a column to a table'
  }]
}


const tableChoices: SelectChoice[] = [createSpace(), {
  name: { type: 'edit-table', table: {name: 'faketable'}},
  message: `• ${chalk.bold("Fake Table Name")}`,
  choices: createColumnChoices()
}, createSpace(), {
  name: { type: 'edit-table', table: {name: 'faketable2'}},
  message: `• ${chalk.bold("Fake Table Name2")}`,
  choices: createColumnChoices()
}, createSpace(), {
  message: `${chalk.green('+')} Add a table`,
  name: { type: 'add-table', table: {columns: [], name: 'faketable'}},
},]

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

  tableAdditions: TableAdd[] = [];
  tableEdits: TableEdit[] = [];
  columnAdditions: ColumnAdd[] = [];
  columnEdits: ColumnEdit[] = [];

  async run(): Promise<any> {
    const { flags } = await this.parseCommand();

  const operations: PgRollMigration["operations"][number][] = []
    
    await this.showSchemaEdit()    
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
    validate(value: string, state: unknown, item: unknown, index: number) {
     return true
    }
  }

  async showSchemaEdit() {

    const select = new Select({
      message: 'Schema for database test:main',
      choices: tableChoices,
      footer:
        'Use the ↑ ↓ arrows to move across the schema, enter to edit or add things, delete or backspace to delete things.'
    });
  
    select.on('keypress', async (char: string, key: { name: string; action: string }) => {
      const flatChoice = tableChoices[select.state.index];
      try {
        const choice = flatChoice.name;
          if (choice.type === 'edit-table') {
            await select.cancel();
            await this.showTableEdit();
          } 
      } catch (error) {}
    });
  
    try {
      const result = await select.run();
      if (result.type === 'add-table') {
      } else if (result.type === 'edit-table') {
        await this.showTableEdit();
      } 
    } catch (error) {
  
    }
  }

  async showTableEdit() {
    this.clear()
    const snippet = new Snippet({
      message: "Edit table name",
      initial: { name: '' },
      fields: [
        this.tableNameField,
      ],
      footer: this.footer,
      template: `
         Name: \${name}
         `
    });

    try {
      const answer = await snippet.run();
      // TODO update state
      console.log('answer', answer) 
      this.showSchemaEdit()
    } catch (err) {
      if (err) throw err;
    }
  }
}


const formatMigration = (op: PgRollMigration["operations"][number], currentMigration: PgRollMigration) => {
  // TODO transform edits into migration
  currentMigration.operations.push(op)
};

const validateMigration = (migration: object) => {
  return PgRollMigrationDefinition.safeParse(migration).success
}


// import { Flags } from "@oclif/core";
// import { BaseCommand } from "../../base";
import { BaseCommand } from '../../base.js';
// import schemas from "@xata.io/pgroll"
import { Flags } from '@oclif/core';
import { Schemas } from '@xata.io/client';
import { OpAlterColumn, OpCreateTable, OpDropTable, OpRenameTable, PgRollMigration, PgRollMigrationDefinition } from '@xata.io/pgroll';
import chalk from 'chalk';
import enquirer from 'enquirer';
import { dummySchema } from './dummySchema.js';

const { Select, Snippet, Confirm } = enquirer as any;

type TableAdd = {
  name: string;
  columns: ColumnAdd[];
}

type TableEdit = {
  name: string;
  newName: string;
  columns: ColumnEdit[];
}

type TableDelete = {
  name: string;
}

type ColumnEdit = {
  name: string;
  unique: boolean;
  nullable: boolean;
  originalName: string;
  tableName: string
  defaultValue: any
  type: string
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

type SelectChoice = {
  name:
  | {
      type: 'space' | 'migrate' | 'schema';
      id: string;
    }
    | {
      type: 'add-table';
      table: TableAdd
      id: string;
    }
    | {
      type: 'edit-table';
      table: TableEdit;
      id: string;
    }
    | {
      type: 'add-column';
      tableName: string;
      id: string;
    }
  | {
      type: 'edit-column';
      column: ColumnEdit;
      id: string;
    }
  message: string;
  role?: string;
  choices?: SelectChoice[];
  disabled?: boolean;
  hint?: string;
}


const types = ['string', 'int', 'float', 'bool', 'text', 'multiple', 'link', 'email', 'datetime', 'vector', 'json'];
const typesList = types.join(', ');
const uniqueUnsupportedTypes = ['text', 'multiple', 'vector', 'json'];
const defaultValueUnsupportedTypes = ['multiple', 'link', 'vector'];
const notNullUnsupportedTypes = defaultValueUnsupportedTypes;

const notEmptyString = (value: string) => {
  return value !== "" ? true : "Name cannot be empty"
}


const generateRandomId = () => {
  return Math.random().toString(36).substring(7);
}

const createSpace = (): SelectChoice => {
  return { name: { type: 'space', id: generateRandomId() }, message: ' ', role: 'heading' };
}


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
  tableDeletions: TableDelete[] = [];
  columnAdditions: ColumnAdd[] = [];
  columnEdits: ColumnEdit[] = [];
  columnDeletions: { [tableName: string]: string[] } = {};

  currentMigration: PgRollMigration = { operations: [] };

  selectItem: {
    type: 'edit-column';
    column: ColumnEdit;
  } | {
    type: 'edit-table';
    table: TableEdit;
  } | null = null;
  activeIndex: number = 0


  editsToMigrations = () => {
    // TODO rename table and rename columns go last
    const tableEdits: {rename_table: OpRenameTable}[] = this.tableEdits.map(({name, newName}) => {
      return {rename_table: {
        type: 'rename_table',
        from: name,
        to: newName
      }}
    })

    const tableDeletions: {drop_table: OpDropTable}[] = this.tableDeletions.map(({name}) => {
      return {drop_table: {
        type: 'drop_table',
        name: name
      }}
    })
    // // TODO IF THERE ARE NEW DELETIONS REMOVE ALL TABLE EDITS AND COLUMNS
    const columnEdits: {alter_column: OpAlterColumn}[] = this.columnEdits.map(({originalName,  tableName, name}) => {
      const edit: {alter_column: OpAlterColumn} = {alter_column: {
        column: originalName,
        table: tableName,
        nullable: false,
        name:  originalName !== name ? name : undefined,
      }}
    return edit
    })
    this.currentMigration.operations.push(...columnEdits)

    const columnDeletions: {drop_column: OpAlterColumn}[] = Object.entries(this.columnDeletions).map((entry) => {
      return entry[1].map((e) => {
        return {
          drop_column: {
          type: 'drop_column',
          column: e,
          table: entry[0]
        }
      }
      })}).flat().filter((operation) => !this.tableDeletions.some(({name}) => operation.drop_column.table === name))
      
    this.currentMigration.operations.push(...tableEdits, ...tableDeletions, ...columnDeletions)
    // const tableAdditions: {create_table: OpCreateTable}[] = this.tableAdditions.map(({name}) => {
    //   return {create_table: {
    //     type: 'create_table',
    //     name: name,
    //     columns: [],
    //   }}
    // })
    // this.currentMigration.operations.push(...tableAdditions)
    // todo column add
    // todo column remove
    // todo column edit
  }

  renderColumnName({column}: {column: ColumnEdit}) {
    // TODO link columns
    const columnEdit = this.columnEdits.filter((edit) => edit.tableName === column.tableName).find(({originalName: editName}) => editName === column.originalName);
    const columnDelete = Object.entries(this.columnDeletions).filter((entry) => entry[0] === column.tableName).find((entry) => entry[1].includes(column.originalName));
    const tableDelete = this.tableDeletions.find(({name}) => name === column.tableName);
   
    const metadata = [
      `${chalk.gray.italic(column.type)}`,
      column.unique ? chalk.gray.italic('unique') : '',
      column.nullable ? chalk.gray.italic('not null') : '',
      column.defaultValue ? chalk.gray.italic(`default: ${column.defaultValue}`) : ''
    ].filter(Boolean)
    .join(' ');

    if (columnDelete || tableDelete) {
      return `  - ${chalk.red.strikethrough(column.originalName)} (${metadata})`
    }
    if (columnEdit) {
      // TODO show separate field edits if name not changed
      return `  - ${chalk.bold(columnEdit.name)} -> ${chalk.yellow.strikethrough(column.originalName)} (${metadata})`
    }
    
   return `- ${chalk.cyan(column.originalName)} (${metadata})`
  }

 renderTableName(originalName: string) {
  const tableEdit = this.tableEdits.find(({name}) => name === originalName);
  const tableDelete = this.tableDeletions.find(({name}) => name === originalName);
  if (tableDelete) {
    return `• ${chalk.red.strikethrough(originalName)}`
  }
  if (tableEdit) {
    return `• ${chalk.bold(tableEdit.newName)} -> ${chalk.yellow.strikethrough(originalName)}`
  }
  return `• ${chalk.bold(originalName)}`;
 }

  async run(): Promise<any> {    
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
      // TODO make sure no other tables have this name
      return notEmptyString(value) 
    }
  }

  async showSchemaEdit() {

  const tableChoices: SelectChoice[] = []

  const schemaChoice: SelectChoice = {
    name: { type: 'schema', id: generateRandomId() },
    message: 'Tables',
    role: 'heading',
    choices: tableChoices
  }
  
  for (const table of dummySchema.schema.tables) {
    let columnChoices: SelectChoice[] = []
    const editTable: SelectChoice = {
      name: { type: 'edit-table', id: generateRandomId(), table: {name: table.name, newName: table.name, columns: [] }},
      message: this.renderTableName(table.name),
      choices: columnChoices,
    }
    tableChoices.push(editTable)
    const columns = Object.values(table.columns);
    const choices: SelectChoice[] = columns.filter(({name}) => !name.startsWith("xata_")).map((column) => {
      const col: ColumnEdit =  {
        name: column.name,
        unique: column.unique,
        nullable: column.notNull,
        tableName: table.name,
        originalName: column.name,
        defaultValue: column.defaultValue,
        type: column.type
      }
        const item = {
          name: { type: "edit-column", 
            column: col
          },
          message: this.renderColumnName({column: col})
        } as any
        return item
      })

      columnChoices.push(...choices)

      columnChoices.push({
        name: { type: 'add-column', tableName: table.name, id: generateRandomId() },
        message: `${chalk.green('+')} Add a column`,
        hint: 'Add a column to a table'
      })

    }

    tableChoices.push(
      createSpace(),{
        message: `${chalk.green('+')} Add a table`,
        name: { type: 'add-table', table: {columns: [], name : ''}, id: generateRandomId()},
      },
      {
        message: `${chalk.green('►')} Run migration`,
        name: { type: 'migrate', id: generateRandomId() },
        hint: "Run the migration"
      }
    )


    const select = new Select({
      message: 'Schema for database test:main',
      initial: this.activeIndex,
      choices: [schemaChoice],
      footer:
        'Use the ↑ ↓ arrows to move across the schema, enter to edit or add things, delete or backspace to delete things.'
    });

    select.on('keypress', async (char: string, key: { name: string; action: string }) => {
      this.activeIndex = select.state.index
      const selectedItem = select.state.choices[select.state.index];
      try {
        if (key.name === 'backspace' || key.name === 'delete') {

          if (!selectedItem) return; // add table is not here for example
          const choice = selectedItem.name;
  
          if (typeof choice !== 'object') return;
      
          // TODO disabling
          if (choice.type === 'edit-table') {
            await select.cancel();  
            await this.toggleTableDelete({initialTableName: choice.table.name});
            await this.showSchemaEdit()
          } 
          if (choice.type === 'edit-column') {
            await select.cancel();  
            await this.toggleColumnDelete(choice);
            await this.showSchemaEdit()
          } 
        }
      } catch (err) {
        if (err) throw err;
        this.clear();
      }
    });

    try {
      const result = await select.run();
      if (result.type === 'add-table') {
      } else if (result.type === "edit-column") {
        this.selectItem = result
        if (!this.tableDeletions.find(({name}) => name === result.column.tableName)) {
          await this.showColumnEdit(result.column);
        }
        await select.cancel();
        // await this.showSchemaEdit();
      } else if (result.type === 'edit-table') {
         this.selectItem = result;
        // console.log("EDITING TABLE", result.table.name)
        if (!this.tableDeletions.find(({name}) => name === result.table.name)) {
          await this.showTableEdit({initialTableName: result.table.name});
        }
        await select.cancel();
        // await this.showSchemaEdit();
        // todo prevent from exiting
      } else if (result.type === "add-column") {
      } else if (result.type === 'migrate') {
        this.editsToMigrations()
        if (validateMigration(this.currentMigration)) {
          // TODO prompt confirm
          this.logJson(this.currentMigration)

        } else {
          this.toErrorJson("Migration is invalid")
        }
        // todo exhaustive check
        // exhaustiveCheck(result.type)
      }
    } catch (error) {
     }
  }

  async toggleTableDelete({initialTableName}: {initialTableName: string}) {
    const existingEntry = this.tableDeletions.find(({name}) => name === initialTableName)
      if (existingEntry) {
        const index = this.tableDeletions.findIndex(({name}) => name === initialTableName);
        if (index > -1) {
          this.tableDeletions.splice(index, 1)         
        }
      } else {
        this.tableDeletions.push({name: initialTableName })
      }
      this.selectItem = {type: 'edit-table', table: {name: initialTableName, newName: initialTableName, columns: []}}
      // TODO empty ALL edits
    }

    async toggleColumnDelete({column}: {column: ColumnEdit}) {
      const existingEntry = Object.entries(this.columnDeletions).filter((entry) => entry[0] === column.tableName).find((entry) => entry[1].includes(column.originalName))
        if (existingEntry) {
          const index = existingEntry[1].findIndex((name) => name === column.originalName);
          if (index > -1) {
           this.columnDeletions[column.tableName].splice(index, 1)         
          }
        } else {
          if (!this.columnDeletions[column.tableName]) {
            this.columnDeletions[column.tableName] = [column.originalName]
          } else {
            this.columnDeletions[column.tableName].push(column.originalName)
          }
          this.selectItem = {type: 'edit-column', column}
        }
      }

async showColumnEdit(column: ColumnEdit) {
  const alterColumnDefaultValues: {alter_column: OpAlterColumn} = {
    alter_column: {
      column: column.originalName,
      // todo replace with real value
      table: column.tableName,
      nullable: column.nullable,
      unique: {name: ""  },
      down: "",
      name: "",
      up: "",
    }
  }
  this.clear();
  const template = `
  {
    alter_column: {
      name: \${name},
      nullable: \${nullable},
      unique: {name: \${unique}},
    }
  }
}`


const noExistingColumnName = (value: string) => {
  // Todo maek sure non edited names to conflict
  return !this.columnEdits.find(({name, tableName}) => tableName === column.tableName && name === value) ? true : "Name already exists"
}

const snippet = new Snippet({
  message: "Edit a column",
  initial: alterColumnDefaultValues,
  fields: [
    {
      name: 'name',
      message: alterColumnDefaultValues.alter_column.column,
      initial: alterColumnDefaultValues.alter_column.column,
      validate: (value: string) => {
        // Todo field does not start with xata_
        return notEmptyString(value) && noExistingColumnName(value)
      }
    },
    {
      name: 'nullable',
      message: alterColumnDefaultValues.alter_column.nullable ? "false" : "true",
      initial: alterColumnDefaultValues.alter_column.nullable ? "false" : "true",
      validate: (value: string) => {
        return notEmptyString(value) && noExistingColumnName(value)
      }
    },
    {
      name: 'unique',
      message: alterColumnDefaultValues.alter_column.unique ? "true" : "false",
      initial: alterColumnDefaultValues.alter_column.unique ? "true" : "false",
      validate: (value: string) => {
        return notEmptyString(value) && noExistingColumnName(value)
      }
    }
  ],
  footer: this.footer,
  template
});
try {
  const { values } = await snippet.run();
    const existingEntry = this.columnEdits.find(({originalName, tableName}) => tableName === column.tableName && originalName === column.originalName)
    if (existingEntry) {
      existingEntry.name = values.name;
      existingEntry.nullable = values.notNull;
      existingEntry.unique = values.unique;
    } else {
      // TODO default value and type
      if (values.name !== column.originalName) {
        this.columnEdits.push({name: values.name, defaultValue: column.defaultValue, type: column.type, nullable: values.notNull, unique: values.unique, originalName: column.originalName, tableName: column.tableName})
      }

    }
    await this.showSchemaEdit();
  
} catch (err) {
  if (err) throw err;
}
}

  async showTableEdit({initialTableName}: {initialTableName: string}) {
    this.clear()
    const snippet = new Snippet({
      message: "Edit table name",
      initial: { name: initialTableName },
      fields: [
        this.tableNameField,
      ],
      
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
      const existingEntry = this.tableEdits.find(({name}) => name === initialTableName)
      if (existingEntry) {

        existingEntry.newName = answer.values.name;
      } else {
        this.tableEdits.push({name: initialTableName, newName: answer.values.name, columns: []})
      }
    } else {
      const index = this.tableEdits.findIndex(({name}) => name === initialTableName);
      if (index > -1) {
        this.tableEdits.splice(index, 1)
      }
    }
     
      this.showSchemaEdit()
    } catch (err) {
      if (err) throw err;
    }
  }
}

const validateMigration = (migration: object) => {
  return PgRollMigrationDefinition.safeParse(migration).success
}


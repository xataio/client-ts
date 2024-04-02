// import { Flags } from "@oclif/core";
// import { BaseCommand } from "../../base";
import { BaseCommand } from '../../base.js';
// import schemas from "@xata.io/pgroll"
import { Flags } from '@oclif/core';
import { Schemas } from '@xata.io/client';
import { OpAlterColumn, OpCreateTable, OpDropTable, OpRenameTable, PgRollMigration, PgRollMigrationDefinition } from '@xata.io/pgroll';
import chalk from 'chalk';
import enquirer from 'enquirer';
// Add table
// Rename table
// Delete table
// Add column
// Edit column
// Delete column

const dummySchema = {
  "branchName": "main",
  "createdAt": "2024-04-02T06:40:39.989Z",
  "databaseName": "csv",
  "id": "bb_fipug7tus17st2pgt6l07q3bn8_o2i56v",
  "lastMigrationID": "",
  "version": 1,
  "metadata": {},
  "schema": {
      "tables": [
          {
              "name": "44",
              "xataCompatible": true,
              "checkConstraints": {
                  "44_xata_id_length_xata_id": {
                      "name": "44_xata_id_length_xata_id",
                      "columns": [
                          "xata_id"
                      ],
                      "definition": "CHECK ((length(xata_id) < 256))"
                  },
                  "44_xata_string_length_stringggrenamed": {
                      "name": "44_xata_string_length_stringggrenamed",
                      "columns": [
                          "emm"
                      ],
                      "definition": "CHECK ((length(emm) <= 2048))"
                  },
                  "44_xata_string_length_test": {
                      "name": "44_xata_string_length_test",
                      "columns": [
                          "test"
                      ],
                      "definition": "CHECK ((length(test) <= 2048))"
                  }
              },
              "foreignKeys": {},
              "primaryKey": [],
              "uniqueConstraints": {
                  "44_stringggrenamed_unique": {
                      "name": "44_stringggrenamed_unique",
                      "columns": [
                          "emm"
                      ]
                  },
                  "_pgroll_new_44_xata_id_key": {
                      "name": "_pgroll_new_44_xata_id_key",
                      "columns": [
                          "xata_id"
                      ]
                  }
              },
              "comment": "",
              "oid": "4563954",
              "columns": [
                  {
                      "name": "emm",
                      "type": "text",
                      "pgType": "text",
                      "notNull": false,
                      "unique": true,
                      "defaultValue": null
                  },
                  {
                      "name": "percentageeee",
                      "type": "float",
                      "pgType": "double precision",
                      "notNull": false,
                      "unique": false,
                      "defaultValue": null
                  },
                  {
                      "name": "price",
                      "type": "float",
                      "pgType": "double precision",
                      "notNull": false,
                      "unique": false,
                      "defaultValue": null
                  },
                  {
                      "name": "symbol",
                      "type": "string",
                      "pgType": "text",
                      "notNull": false,
                      "unique": false,
                      "defaultValue": null
                  },
                  {
                      "name": "test",
                      "type": "string",
                      "pgType": "text",
                      "notNull": false,
                      "unique": false,
                      "defaultValue": null
                  },
                  {
                      "name": "timestamp",
                      "type": "datetime",
                      "pgType": "timestamptz",
                      "notNull": false,
                      "unique": false,
                      "defaultValue": null
                  },
                  {
                      "name": "xata_createdat",
                      "type": "datetime",
                      "pgType": "timestamptz",
                      "notNull": true,
                      "unique": false,
                      "defaultValue": "now()"
                  },
                  {
                      "name": "xata_id",
                      "type": "text",
                      "pgType": "text",
                      "notNull": true,
                      "unique": true,
                      "defaultValue": "('rec_'::text || (xata_private.xid())::text)"
                  },
                  {
                      "name": "xata_updatedat",
                      "type": "datetime",
                      "pgType": "timestamptz",
                      "notNull": true,
                      "unique": false,
                      "defaultValue": "now()"
                  },
                  {
                      "name": "xata_version",
                      "type": "int",
                      "pgType": "integer",
                      "notNull": true,
                      "unique": false,
                      "defaultValue": "0"
                  }
              ]
          },
          {
              "name": "678",
              "xataCompatible": true,
              "checkConstraints": {
                  "678_xata_id_length_xata_id": {
                      "name": "678_xata_id_length_xata_id",
                      "columns": [
                          "xata_id"
                      ],
                      "definition": "CHECK ((length(xata_id) < 256))"
                  }
              },
              "foreignKeys": {},
              "primaryKey": [],
              "uniqueConstraints": {
                  "678_percentageee_unique": {
                      "name": "678_percentageee_unique",
                      "columns": [
                          "percentageee"
                      ]
                  },
                  "_pgroll_new_678_xata_id_key": {
                      "name": "_pgroll_new_678_xata_id_key",
                      "columns": [
                          "xata_id"
                      ]
                  }
              },
              "comment": "",
              "oid": "4564039",
              "columns": [
                  {
                      "name": "percentageee",
                      "type": "float",
                      "pgType": "double precision",
                      "notNull": true,
                      "unique": true,
                      "defaultValue": null
                  },
                  {
                      "name": "pricer",
                      "type": "float",
                      "pgType": "double precision",
                      "notNull": false,
                      "unique": false,
                      "defaultValue": null
                  },
                  {
                      "name": "symbolll",
                      "type": "string",
                      "pgType": "text",
                      "notNull": false,
                      "unique": false,
                      "defaultValue": null
                  },
                  {
                      "name": "timestamp",
                      "type": "datetime",
                      "pgType": "timestamptz",
                      "notNull": false,
                      "unique": false,
                      "defaultValue": null
                  },
                  {
                      "name": "xata_createdat",
                      "type": "datetime",
                      "pgType": "timestamptz",
                      "notNull": true,
                      "unique": false,
                      "defaultValue": "now()"
                  },
                  {
                      "name": "xata_id",
                      "type": "text",
                      "pgType": "text",
                      "notNull": true,
                      "unique": true,
                      "defaultValue": "('rec_'::text || (xata_private.xid())::text)"
                  },
                  {
                      "name": "xata_updatedat",
                      "type": "datetime",
                      "pgType": "timestamptz",
                      "notNull": true,
                      "unique": false,
                      "defaultValue": "now()"
                  },
                  {
                      "name": "xata_version",
                      "type": "int",
                      "pgType": "integer",
                      "notNull": true,
                      "unique": false,
                      "defaultValue": "0"
                  }
              ]
          },
          {
            "name": "emily",
            "xataCompatible": true,
            "checkConstraints": {
                "678_xata_id_length_xata_id": {
                    "name": "678_xata_id_length_xata_id",
                    "columns": [
                        "xata_id"
                    ],
                    "definition": "CHECK ((length(xata_id) < 256))"
                }
            },
            "foreignKeys": {},
            "primaryKey": [],
            "uniqueConstraints": {
                "678_percentageee_unique": {
                    "name": "678_percentageee_unique",
                    "columns": [
                        "percentageee"
                    ]
                },
                "_pgroll_new_678_xata_id_key": {
                    "name": "_pgroll_new_678_xata_id_key",
                    "columns": [
                        "xata_id"
                    ]
                }
            },
            "comment": "",
            "oid": "4564039",
            "columns": [
                {
                    "name": "percentageee",
                    "type": "float",
                    "pgType": "double precision",
                    "notNull": true,
                    "unique": true,
                    "defaultValue": null
                },
                {
                    "name": "pricer",
                    "type": "float",
                    "pgType": "double precision",
                    "notNull": false,
                    "unique": false,
                    "defaultValue": null
                },
                {
                    "name": "symbolll",
                    "type": "string",
                    "pgType": "text",
                    "notNull": false,
                    "unique": false,
                    "defaultValue": null
                },
                {
                    "name": "timestamp",
                    "type": "datetime",
                    "pgType": "timestamptz",
                    "notNull": false,
                    "unique": false,
                    "defaultValue": null
                },
                {
                    "name": "xata_createdat",
                    "type": "datetime",
                    "pgType": "timestamptz",
                    "notNull": true,
                    "unique": false,
                    "defaultValue": "now()"
                },
                {
                    "name": "xata_id",
                    "type": "text",
                    "pgType": "text",
                    "notNull": true,
                    "unique": true,
                    "defaultValue": "('rec_'::text || (xata_private.xid())::text)"
                },
                {
                    "name": "xata_updatedat",
                    "type": "datetime",
                    "pgType": "timestamptz",
                    "notNull": true,
                    "unique": false,
                    "defaultValue": "now()"
                },
                {
                    "name": "xata_version",
                    "type": "int",
                    "pgType": "integer",
                    "notNull": true,
                    "unique": false,
                    "defaultValue": "0"
                }
            ]
        },
      ]
  }
}

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

const types = ['string', 'int', 'float', 'bool', 'text', 'multiple', 'link', 'email', 'datetime', 'vector', 'json'];
const typesList = types.join(', ');
const uniqueUnsupportedTypes = ['text', 'multiple', 'vector', 'json'];
const defaultValueUnsupportedTypes = ['multiple', 'link', 'vector'];
const notNullUnsupportedTypes = defaultValueUnsupportedTypes;

type SelectChoice = {
  name:
  | {
      type: 'space' | 'migrate' | 'schema';
    }
    | {
      type: 'add-table';
      table: TableAdd
    }
    | {
      type: 'edit-table';
      table: TableEdit;
    }
    | {
      type: 'add-column';
      tableName: string;
    }
  | {
      type: 'edit-column';
      column: ColumnEdit;
    }
  message: string;
  role?: string;
  choices?: SelectChoice[];
  disabled?: boolean;
  hint?: string;
}

const createSpace = (): SelectChoice => {
  return { name: { type: 'space' }, message: ' ', role: 'heading' };
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

  selectItem: ColumnEdit | TableEdit | null = null;
  flatChoices: SelectChoice[] = []


  editsToMigrations = () => {
    // TODO rename table and rename columns go last
    const tableEdits: {rename_table: OpRenameTable}[] = this.tableEdits.map(({name, newName}) => {
      return {rename_table: {
        type: 'rename_table',
        from: name,
        to: newName
      }}
    })
    this.currentMigration.operations.push(...tableEdits)
    const tableDeletions: {drop_table: OpDropTable}[] = this.tableDeletions.map(({name}) => {
      return {drop_table: {
        type: 'drop_table',
        name: name
      }}
    })
    // // TODO IF THERE ARE NEW DELETIONS REMOVE ALL TABLE EDITS AND COLUMNS
    this.currentMigration.operations.push(...tableDeletions)
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
    this.currentMigration.operations.push(...columnDeletions)
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
     return value !== "" ? true : "Name cannot be empty"
    }
  }

  async showSchemaEdit() {

  this.flatChoices = []
  const tableChoices: SelectChoice[] = []

  let index = -1

  for (const table of dummySchema.schema.tables) {
    index = index + 1
    const columns = Object.values(table.columns);
    const columnChoices: SelectChoice[] = columns.filter(({name}) => !name.startsWith("xata_")).map((column, columnIndex) => {
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
        if ((this.selectItem as any)?.originalName === col?.originalName && (this.selectItem as any)?.tableName === col?.tableName) index = this.flatChoices.length + columnIndex + 1;
        return item
      })

      // TODO disable when deleted
        columnChoices.push({
          name: { type: 'add-column', tableName: table.name },
          message: `${chalk.green('+')} Add a column`,
          hint: 'Add a column to a table'
        })

      const editTable: SelectChoice = {
        name: { type: 'edit-table', table: {name: table.name, newName: table.name, columns: [] }},
        message: this.renderTableName(table.name),
        choices: columnChoices,
      }

      this.flatChoices.push(editTable, ...columnChoices)
      tableChoices.push(editTable)
      const indexOfTable = this.flatChoices.findIndex(({name}) => name === editTable.name)
      console.log("index of table", indexOfTable)
      if ((this.selectItem as any)?.name === (editTable.name as any).table?.name) index = indexOfTable ?? 0

    }

  const formatting: SelectChoice[] = [
    createSpace(),{
      message: `${chalk.green('+')} Add a table`,
      name: { type: 'add-table', table: {columns: [], name : ''}},
    },
    {
      message: `${chalk.green('►')} Run migration`,
      name: { type: 'migrate' },
      hint: "Run the migration"
    }
  ]
  tableChoices.push(...formatting)
    const select = new Select({
      message: 'Schema for database test:main',
      initial: index,
      choices: [
        {
          name: { type: 'schema' },
          message: 'Tables',
          role: 'heading',
          choices: tableChoices
        },
      ],
      footer:
        'Use the ↑ ↓ arrows to move across the schema, enter to edit or add things, delete or backspace to delete things.'
    });

    select.on('keypress', async (char: string, key: { name: string; action: string }) => {
      const flatChoice = this.flatChoices[select.state.index - 1];
      // console.log("flat choice exists", flatChoice)
      try {
        if (key.name === 'backspace' || key.name === 'delete') {

          if (!flatChoice) return; // add table is not here for example
          const choice = flatChoice.name;
  
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
        // todo typesafe
        this.selectItem = result.column

        if (!this.tableDeletions.find(({name}) => name === result.column.tableName)) {
          await this.showColumnEdit(result.column);
        }
        await select.cancel();
        // await this.showSchemaEdit();
      } else if (result.type === 'edit-table') {
        this.selectItem = result.table;
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
        this.selectItem = {name: initialTableName, newName: initialTableName, columns: []}
      }
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
          this.selectItem = column
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

const snippet = new Snippet({
  // todo show information about field
  message: "Edit a column",
  initial: alterColumnDefaultValues,
  fields: [
    {
      name: 'name',
      message: alterColumnDefaultValues.alter_column.column,
    },
    {
      name: 'nullable',
      message: alterColumnDefaultValues.alter_column.nullable ? "false" : "true",
    },
    {
      name: 'unique',
      message: alterColumnDefaultValues.alter_column.unique ? "true" : "false",
    }
  ],
  // TODO name cannot be empty
  // TODO name cannot be already taken
  footer: this.footer,
  template
});
try {
  const { values } = await snippet.run();
    const existingEntry = this.columnEdits.find(({originalName}) => originalName === column.originalName)
    if (existingEntry) {
      existingEntry.name = values.name;
      existingEntry.nullable = values.notNull;
      existingEntry.unique = values.unique;
    } else {
      // TODO default value and type
      this.columnEdits.push({name: values.name, defaultValue: null, type: "string", nullable: values.notNull, unique: values.unique, originalName: column.originalName, tableName: column.tableName})
    }
    await this.showSchemaEdit();
  
} catch (err) {
  if (err) throw err;
}
}

  async showTableEdit({initialTableName}: {initialTableName: string}) {
    // TODO the new name is not being showed during
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


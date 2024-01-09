import { Config, Flags } from '@oclif/core';
import { BaseCommand } from '../../base.js';
import EditSchemaOld from './editOld.js';
import EditSchemaNew from './editNew.js';
import { getBranchDetailsWithPgRoll, isBranchPgRollEnabled } from '../../migrations/pgroll.js';

export default class EditSchema extends BaseCommand<typeof EditSchema> {
  static description = 'Edit the schema of the current database';

  static examples = [];

  static flags = {
    ...this.databaseURLFlag,
    branch: this.branchFlag,
    source: Flags.boolean({
      description: 'Edit the schema as a JSON document in your default editor'
    })
  };

  static args = {};

  async run(): Promise<void> {
    const config = await Config.load();

    const { flags } = await this.parseCommand();

    const xata = await this.getXataClient();
    const { workspace, region, database, branch } = await this.getParsedDatabaseURLWithBranch(
      flags.db,
      flags.branch,
      true
    );

    const details = await getBranchDetailsWithPgRoll(xata, { workspace, region, database, branch });

    if (isBranchPgRollEnabled(details)) {
      const editNew = new EditSchemaNew(this.argv, config);
      editNew.launch({
        workspace,
        region,
        database,
        branch
      });
    } else {
      const editOld = new EditSchemaOld(this.argv, config);
      editOld.launch({
        workspace,
        region,
        database,
        branch
      });
    }

    const args = [waitFlag, tmpobj.name].filter(Boolean);
    await this.runCommand(binary, args);

    const newSchema = await readFile(tmpobj.name, 'utf8');
    const result = parseSchemaFile(newSchema);
    if (!result.success) {
      this.printZodError(result.error);
      this.error('The schema is not valid. See the errors above');
    }

    await this.deploySchema(this.workspace, this.region, this.database, this.branch, result.data);

    // Run pull to retrieve remote migrations
    await Pull.run([this.branch]);
  }

  async showInteractiveEditing(branchDetails: Schemas.DBBranch) {
    this.branchDetails = branchDetails;
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
        if (key.name === 'backspace' || key.name === 'delete') {
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
      if (!linkedTable) return chalk.gray.italic(column.type);
      return `${chalk.gray.italic(column.type)} → ${chalk.gray.italic(linkedTable.name)}`;
    }
    const metadata = [
      getType(),
      column.unique ? chalk.gray.italic('unique') : '',
      column.notNull ? chalk.gray.italic('not null') : '',
      column.defaultValue ? chalk.gray.italic(`default: ${column.defaultValue}`) : ''
    ]
      .filter(Boolean)
      .join(' ');
    if (table.deleted || column.deleted || linkedTable?.deleted)
      return `- ${chalk.red.strikethrough(column.name)} (${metadata})`;
    if (table.added || column.added) return `- ${chalk.green(column.name)} (${metadata})`;
    if (column.initialName)
      return `- ${chalk.cyan(column.name)} ${chalk.yellow.strikethrough(column.initialName)} (${metadata})`;
    return `- ${chalk.cyan(column.name)} (${metadata})`;
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
    const isColumnAdded = !column || column?.added;
    const template = `
           name: \${name}
           type: \${type}
           link: \${link}
vectorDimension: \${vectorDimension}
    description: \${description}
         unique: \${unique}
        notNull: \${notNull}
   defaultValue: \${defaultValue}`;

    const initial: ColumnEditState['initial'] = {
      name: column?.name || '',
      type: column?.type || '',
      link: isColumnAdded ? '' : column?.link?.table,
      vectorDimension: column?.vector?.dimension ? `${column?.vector?.dimension}` : undefined,
      notNull: column?.notNull ? 'true' : 'false',
      defaultValue: column?.defaultValue || '',
      unique: column?.unique ? 'true' : 'false',
      description: isColumnAdded ? '' : column?.description
    };
    const snippet: any = new Snippet({
      message: column?.name || 'a new column',
      initial,
      fields: [
        {
          name: 'name',
          message: 'The column name',
          validate(value: string | undefined, state: ColumnEditState, item: unknown, index: number) {
            if (!identifier.test(value || '')) {
              return snippet.styles.danger(`Column name has to match ${identifier}`);
            }
            return true;
          }
        },
        {
          name: 'type',
          message: `The column type (${typesList})`,
          validate(value: string | undefined, state: ColumnEditState, item: unknown, index: number) {
            if (!isColumnAdded && value !== state.initial.type) {
              return `Cannot change the type of existing columns`;
            }
            if (!value || !types.includes(value)) {
              return `Type needs to be one of ${typesList}`;
            }
            return true;
          }
        },
        {
          name: 'link',
          message: 'Linked table. Only for columns that are links',
          validate(
            value: string | undefined,
            state: ColumnEditState,
            item: { value: string | undefined },
            index: number
          ) {
            if (!isColumnAdded && value !== state.initial.link) {
              return `Cannot change the link of existing link columns`;
            }
            if (state.values.type === 'link') {
              if (!value) {
                return 'The link field must be filled for columns of type `link`';
              }
            } else if (value) {
              return 'The link field must not be filled unless the type of the column is `link`';
            }
            return true;
          }
        },
        {
          name: 'vectorDimension',
          message: 'Vector Dimension. Only for columns that are vectors',
          validate(
            value: string | undefined,
            state: ColumnEditState,
            item: { value: string | undefined },
            index: number
          ) {
            if (!isColumnAdded && value !== state.initial.vectorDimension) {
              return `Cannot change the vector dimension of existing vector columns`;
            }
            if (state.values.type === 'vector') {
              if (!value) {
                return 'The vectorDimension field must be filled for columns of type `vector`';
              }
            } else if (value) {
              return 'The vectorDimension field must not be filled unless the type of the column is `vector`';
            }
            return true;
          }
        },
        {
          name: 'unique',
          message: 'Whether the column is unique (true/false)',
          validate(value: string | undefined, state: ColumnEditState, item: unknown, index: number) {
            if (!isColumnAdded && parseBoolean(value) !== parseBoolean(state.initial.unique)) {
              return `Cannot change unique for existing columns`;
            }
            const validateOptionalBooleanResult = validateOptionalBoolean(value);
            if (validateOptionalBooleanResult !== true) {
              return validateOptionalBooleanResult;
            }
            const validateUniqueResult = validateUnique(value, state);
            if (validateUniqueResult !== true) {
              return validateUniqueResult;
            }
            return true;
          }
        },
        {
          name: 'notNull',
          message: 'Whether the column is not nullable (true/false)',
          validate(value: string | undefined, state: ColumnEditState, item: unknown, index: number) {
            if (!isColumnAdded && parseBoolean(value) !== parseBoolean(state.initial.notNull)) {
              return `Cannot change notNull for existing columns`;
            }
            const validateOptionalBooleanResult = validateOptionalBoolean(value);
            if (validateOptionalBooleanResult !== true) {
              return validateOptionalBooleanResult;
            }
            const validateNotNullResult = validateNotNull(value, state);
            if (validateNotNullResult !== true) {
              return validateNotNullResult;
            }
            return true;
          }
        },
        {
          name: 'description',
          message: 'An optional column description',
          validate(value: string | undefined, state: ColumnEditState, item: unknown, index: number) {
            if (!isColumnAdded && value !== state.initial.description) {
              return `Cannot change description for existing columns`;
            }
            return true;
          }
        },
        {
          name: 'defaultValue',
          message: 'Default value',
          validate(rawDefaultValue: string | undefined, state: ColumnEditState, item: unknown, index: number) {
            if (
              !isColumnAdded &&
              state.values.type &&
              parseDefaultValue(state.values.type, rawDefaultValue) !==
                parseDefaultValue(state.values.type, state.initial.defaultValue)
            ) {
              return `Cannot change defaultValue for existing columns`;
            }
            if (state.values.type) {
              const isNotNull = parseBoolean(state.values.notNull) === true;
              const defaultValue = parseDefaultValue(state.values.type, rawDefaultValue);
              if (isNotNull && (!rawDefaultValue || rawDefaultValue.length === 0)) {
                return 'defaultValue must be set for `notNull: true` columns';
              }
              if (rawDefaultValue && rawDefaultValue.length > 0 && defaultValue === undefined) {
                return `Invalid defaultValue for Type: ${state.values.type}`;
              }
            }
            return true;
          }
        }
      ],
      footer() {
        return '\nUse the ↑ ↓ arrows to move across fields, enter to submit and escape to cancel.';
      },
      template
    });

    try {
      const { values } = await snippet.run();
      const unique = parseBoolean(values.unique);
      const notNull = parseBoolean(values.notNull);
      const col: Column = {
        name: values.name,
        type: values.type,
        link: values.link && values.type === 'link' ? { table: values.link } : undefined,
        vector: values.vectorDimension ? { dimension: parseInt(values.vectorDimension, 10) } : undefined,
        unique: unique || undefined,
        notNull: notNull || undefined,
        defaultValue: parseDefaultValue(values.type, values.defaultValue)
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
    const region = this.region;
    const database = this.database;

    const xata = await this.getXataClient();
    const branch = this.branchDetails.branchName;

    const edits: Schemas.SchemaEditScript = {
      operations: []
    };

    // Create tables, update tables, delete columns and update columns
    for (const table of this.tables) {
      if (table.added) {
        this.info(`Creating table ${table.name}`);
        edits.operations.push({
          addTable: {
            table: table.name
          }
        });
        // await xata.tables.createTable({ workspace, region, database, branch, table: table.name });
      } else if (table.initialName) {
        this.info(`Renaming table ${table.initialName} to ${table.name}`);
        edits.operations.push({
          renameTable: {
            newName: table.name,
            oldName: table.initialName
          }
        });
      }

      for (const column of table.columns) {
        const linkedTable = this.tables.find((t) => (t.initialName || t.name) === column.link?.table);
        if (column.deleted || linkedTable?.deleted) {
          this.info(`Deleting column ${table.name}.${column.name}`);
          edits.operations.push({
            removeColumn: {
              table: table.name,
              column: column.name
            }
          });
        } else if (column.initialName) {
          this.info(`Renaming column ${table.name}.${column.initialName} to ${table.name}.${column.name}`);
          edits.operations.push({
            renameColumn: {
              table: table.name,
              newName: column.name,
              oldName: column.initialName
            }
          });
        }
      }
    }

    // Delete tables and create columns
    for (const table of this.tables) {
      if (table.deleted) {
        this.info(`Deleting table ${table.name}`);
        edits.operations.push({
          removeTable: {
            table: table.name
          }
        });
        continue;
      }

      for (const column of table.columns) {
        if (table.added || column.added) {
          this.info(`Adding column ${table.name}.${column.name}`);
          edits.operations.push({
            addColumn: {
              table: table.name,
              column: {
                name: column.name,
                type: column.type,
                link: column.link,
                vector: column.vector,
                unique: column.unique,
                notNull: column.notNull,
                defaultValue: column.defaultValue
              }
            }
          });
        }
      }
    }

    await xata.api.migrations.applyBranchSchemaEdit({
      pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
      body: { edits }
    });

    this.success('Migration completed!');
  }
}

function parseBoolean(value?: string) {
  if (!value) return undefined;
  const val = value.toLowerCase();
  if (['true', 't', '1', 'y', 'yes'].includes(val)) return true;
  if (['false', 'f', '0', 'n', 'no'].includes(val)) return false;
  return null;
}

function validateOptionalBoolean(value?: string) {
  const bool = parseBoolean(value);
  if (bool === null) {
    return 'Please enter a boolean value (e.g. yes, no, true, false) or leave it empty';
  }
  return true;
}

function validateUnique(uniqueValue: string | undefined, state: ColumnEditState) {
  const isUnique = parseBoolean(uniqueValue);
  if (isUnique && state.values.type && uniqueUnsupportedTypes.includes(state.values.type)) {
    return `Column type \`${state.values.type}\` does not support \`unique: true\``;
  }
  if (isUnique && parseBoolean(state.values.notNull)) {
    return 'Column cannot be both `unique: true` and `notNull: true`';
  }
  if (isUnique && state.values.defaultValue) {
    return 'Column cannot be both `unique: true` and have a `defaultValue` set';
  }
  return true;
}

function validateNotNull(notNullValue: string | undefined, state: ColumnEditState) {
  const isNotNull = parseBoolean(notNullValue);
  if (isNotNull && state.values.type && notNullUnsupportedTypes.includes(state.values.type)) {
    return `Column type \`${state.values.type}\` does not support \`notNull: true\``;
  }

  return true;
}

function parseDefaultValue(type: string, val?: string): string | undefined {
  if (val === undefined || defaultValueUnsupportedTypes.includes(type)) {
    return undefined;
  }
  const num = String(val).length > 0 ? +val : undefined;

  if (['text', 'string'].includes(type)) {
    return val === '' ? undefined : String(val);
  } else if (type === 'int') {
    return Number.isSafeInteger(num) && val !== '' ? String(num) : undefined;
  } else if (type === 'float') {
    return Number.isFinite(num) && val !== '' ? String(num) : undefined;
  } else if (type === 'bool') {
    const booleanValue = parseBoolean(val);
    return !isNil(booleanValue) ? String(booleanValue) : undefined;
  } else if (type === 'email') {
    if (!isValidEmail(val)) {
      return undefined;
    }
    return val;
  } else if (type === 'datetime') {
    // Date fields have special values
    if (['now'].includes(val)) return val;

    const date = new Date(val);
    return isNaN(date.getTime()) ? undefined : date.toISOString();
  } else {
    return undefined;
  }
}

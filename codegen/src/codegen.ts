import * as fs from 'fs/promises';
import * as path from 'path';
import { singular } from 'pluralize';
import { ZodError } from 'zod';
import { Column, fileSchema, Table } from './schema';

import prettier from 'prettier';

function getTypeName(tableName: string) {
  const snglr = singular(tableName);
  return snglr.substring(0, 1).toUpperCase() + snglr.substring(1);
}

function generateTableType(table: Table) {
  const { columns } = table;
  const revLinks: { table: string }[] = []; // table.rev_links || [];
  return `export interface ${getTypeName(table.name)} extends XataRecord {
    ${columns.map((column) => generateColumnType(column)).join('\n')}
    ${revLinks.map((link) => `${link.table}: Query<${getTypeName(link.table)}>`).join('\n')}
  };
  `;
}

function generateColumnType(column: Column) {
  return `${column.name}: ${getTypeScriptType(column)}`;
}

function getTypeScriptType(column: Column): string {
  if (column.type === 'email') return 'string';
  if (column.type === 'text') return 'string';
  if (column.type === 'string') return 'string';
  if (column.type === 'multiple') return 'string[]';
  if (column.type === 'bool') return 'boolean';
  if (column.type === 'int') return 'number';
  if (column.type === 'link') {
    if (!column.link?.table) return 'object';
    return getTypeName(column.link.table);
  }
  if (column.type === 'object') {
    const columns = column.columns || [];
    return `{
      ${columns.map((column) => generateColumnType(column)).join('\n')}
    }`;
  }
  return 'unknown';
}

async function readSchema(fullPath: string) {
  try {
    return await fs.readFile(fullPath, 'utf-8');
  } catch (err) {
    console.error('Could not read schema file at', fullPath);
    process.exit(1);
  }
}

function parseSchema(input: string) {
  try {
    return fileSchema.parse(JSON.parse(input));
  } catch (err) {
    console.error('The content of the schema file is not valid:');
    if (err instanceof ZodError) {
      const zodError = err as ZodError;
      for (const error of zodError.errors) {
        console.error(`  [${error.code}]`, error.message, 'at', `"${error.path.join('.')}"`);
      }
    } else {
      console.error(' ', err instanceof Error ? err.message : err);
    }
    process.exit(1);
  }
}

export async function generate(schemaFile: string, output: string) {
  const fullSchemaPath = path.resolve(process.cwd(), schemaFile);
  const fullOutputPath = path.resolve(process.cwd(), output);
  console.log('Using schema file:', fullSchemaPath);
  console.log('Using output file:', fullOutputPath);
  console.log();
  const input = await readSchema(schemaFile);
  const schema = parseSchema(input);

  const { tables } = schema;
  const links: Record<string, string[][]> = {};
  for (const table of tables) {
    links[table.name] = [];
    for (const column of table.columns) {
      if (column.link) {
        links[table.name].push([column.name, column.link.table]);
      }
    }
  }

  const code = `
    import {
      BaseClient,
      Query,
      Repository,
      RestRespositoryFactory,
      XataClientOptions,
      XataRecord
    } from '@xata.io/client';

    ${tables.map((table) => generateTableType(table)).join('\n')}

    const links = ${JSON.stringify(links)};

    export class XataClient extends BaseClient<{
      ${tables.map((table) => `"${table.name}": Repository<${getTypeName(table.name)}>;`).join('\n')}
    }> {
      constructor(options: XataClientOptions) {
        super(options, links);
        const factory = options.repositoryFactory || new RestRespositoryFactory();
        this.db = {
          ${tables.map((table) => `"${table.name}": factory.createRepository(this, "${table.name}"),`).join('\n')}
        };
      }
    }
  `;

  const pretty = prettier.format(code, { parser: 'typescript' });

  await fs.writeFile(fullOutputPath, pretty);
}

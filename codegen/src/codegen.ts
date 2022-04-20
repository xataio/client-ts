import pluralize from 'pluralize';
import ts from 'typescript';
import prettier, { BuiltInParserName } from 'prettier';
import parserJavascript from 'prettier/parser-babel.js';
import parserTypeScript from 'prettier/parser-typescript.js';
import { XataConfigSchema } from './config.js';
import { Column, Table, XataDatabaseSchema } from './schema.js';

export type GenerateOptions = {
  schema: XataDatabaseSchema;
  config: XataConfigSchema;
  language: Language;
  javascriptTarget?: JavascriptTarget;
};

function getTypeName(tableName: string) {
  const snglr = pluralize.singular(tableName);
  return snglr.substring(0, 1).toUpperCase() + snglr.substring(1);
}

function generateTableType(table: Table) {
  const { columns } = table;
  const revLinks: { table: string }[] = []; // table.rev_links || [];
  return `export interface ${getTypeName(table.name)} extends Identifiable {
    ${columns.map((column) => generateColumnType(column)).join('\n')}
    ${revLinks.map((link) => `${link.table}: Query<${getTypeName(link.table)}>`).join('\n')}
  };

  export type ${getTypeName(table.name)}Record = ${getTypeName(table.name)} & XataRecord;
  `;
}

function generateColumnType(column: Column) {
  return `${column.name}?: ${getTypeScriptType(column)} | null`;
}

function generateJSdocType(table: Table) {
  const { columns } = table;
  const revLinks: { table: string }[] = []; // table.rev_links || [];
  const typeName = getTypeName(table.name);
  return `
/**
 * @typedef {Object} ${typeName}
 * @property {string} id
 * @property {Object} xata
 * @property {() => Promise<${typeName}>} read
 * @property {() => Promise<${typeName}>} update
 * @property {() => Promise<void>} delete
 ${columns.map((column) => generateJSDocColumnType(column)).join('\n ')}
 ${revLinks.map((link) => `${link.table}: Query<${getTypeName(link.table)}>`).join('\n ')}
 */`;
}

function generateJSDocColumnType(column: Column) {
  return `* @property {${getTypeScriptType(column)}=} ${column.name}`;
}

function getTypeScriptType(column: Column): string {
  if (column.type === 'email') return 'string';
  if (column.type === 'text') return 'string';
  if (column.type === 'string') return 'string';
  if (column.type === 'multiple') return 'string[]';
  if (column.type === 'bool') return 'boolean';
  if (column.type === 'int') return 'number';
  if (column.type === 'float') return 'number';
  if (column.type === 'link') {
    if (!column.link?.table) return 'object';
    return getTypeName(column.link.table);
  }
  if (column.type === 'object') {
    const columns = column.columns || [];
    return `{ ${columns.map((column) => generateColumnType(column)).join('; ')} }`;
  }
  return 'unknown';
}

export type Language = 'typescript' | 'javascript';
export type JavascriptTarget = keyof typeof ts.ScriptTarget | undefined;

export async function generate({ schema, config, language, javascriptTarget }: GenerateOptions) {
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

  const parser = prettierParsers[language];

  const code = `
  ${language === 'javascript' ? `    /** @typedef { import('@xata.io/client').Repository } Repository */` : ''}
    import {
      BaseClient,
      Repository,
      Identifiable,
      RestRespositoryFactory,
      XataClientOptions,
      XataRecord
    } from '@xata.io/client';

    ${tables.map((table) => generateTableType(table)).join('\n')}

    ${language === 'javascript' ? tables.map((table) => generateJSdocType(table)).join('\n') : ''}

    const links = ${JSON.stringify(links)};

    export class XataClient extends BaseClient<{
      ${tables.map((table) => `"${table.name}": Repository<${getTypeName(table.name)}Record>;`).join('\n')}
    }> {
      constructor(options: XataClientOptions) {
        super({ databaseURL: "https://${config.workspaceID}.xata.sh/db/${config.dbName}", ...options}, links);
        
        const factory = options.repositoryFactory || new RestRespositoryFactory();
        ${
          language === 'javascript'
            ? `/** @type {{ ${tables.map((table) => `"${table.name}": Repository`).join('; ')} }} */`
            : ''
        }
        
        this.db = {
          ${tables.map((table) => `"${table.name}": factory.createRepository(this, "${table.name}"),`).join('\n')}
        };
      }
    }
  `;

  const transpiled = transpile(code, language, javascriptTarget);

  return prettier.format(transpiled, { parser, plugins: [parserTypeScript, parserJavascript] });
}

const prettierParsers: Record<Language, BuiltInParserName> = {
  typescript: 'typescript',
  javascript: 'babel'
};

function transpile(code: string, language: Language, javascriptTarget: JavascriptTarget = 'ES2020') {
  switch (language) {
    case 'typescript':
      return code;
    case 'javascript':
      return ts.transpile(code, { target: ts.ScriptTarget[javascriptTarget] });
  }
}

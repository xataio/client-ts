import pluralize from 'pluralize';
import ts from 'typescript';
import prettier, { BuiltInParserName } from 'prettier';
import parserJavascript from 'prettier/parser-babel.js';
import parserTypeScript from 'prettier/parser-typescript.js';
import { Column, Table, XataDatabaseSchema } from './schema.js';

export type GenerateOptions = {
  schema: XataDatabaseSchema;
  databaseUrl: string;
  language: Language;
  javascriptTarget?: JavascriptTarget;
};

export type GenerateOutput = {
  original: string;
  transpiled: string;
  declarations?: string;
};

function getTypeName(tableName: string) {
  const snglr = pluralize.singular(tableName);

  // If table starts with a number, prepend a $ sign
  if (snglr.match(/^\d/)) return `$${snglr}`;

  return snglr.substring(0, 1).toUpperCase() + snglr.substring(1);
}

function generateTableType(table: Table) {
  const { columns } = table;
  const revLinks: { table: string }[] = []; // table.rev_links || [];
  return `export interface ${getTypeName(table.name)} {
    ${columns.map((column) => generateColumnType(column)).join('\n')}
    ${revLinks.map((link) => `${link.table}: Query<${getTypeName(link.table)}>`).join('\n')}
  };

  export type ${getTypeName(table.name)}Record = ${getTypeName(table.name)} & XataRecord;
  `;
}

function generateColumnType(column: Column) {
  return `${column.name}?: ${getTypeScriptType(column)} | null`;
}

function generateJSDocImportTypes(tables: Table[]) {
  return tables
    .map(
      (table) => `
  /** @typedef { import('./types').${getTypeName(table.name)} } ${getTypeName(table.name)} */
  /** @typedef { import('./types').${getTypeName(table.name)}Record } ${getTypeName(table.name)}Record */
  /** @typedef { import('@xata.io/client').Repository<${getTypeName(table.name)}, ${getTypeName(
        table.name
      )}Record> } ${getTypeName(table.name)}Repository */
`
    )
    .join('\n');
}

function generateJSDocInternalType(tables: Table[]) {
  return `/** @type {{ ${tables
    .map((table) => `"${table.name}": ${getTypeName(table.name)}Repository`)
    .join('; ')} }} */`;
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
    return `${getTypeName(column.link.table)}Record`;
  }
  if (column.type === 'object') {
    const columns = column.columns || [];
    return `{ ${columns.map((column) => generateColumnType(column)).join('; ')} }`;
  }
  return 'unknown';
}

export type Language = 'typescript' | 'javascript';
export type JavascriptTarget = keyof typeof ts.ScriptTarget | undefined;

export async function generate({
  schema,
  databaseUrl,
  language,
  javascriptTarget
}: GenerateOptions): Promise<GenerateOutput> {
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
    import {
      BaseClient,
      Repository,
      RestRespositoryFactory,
      XataClientOptions,
      XataRecord
    } from '@xata.io/client';

    ${tables.map((table) => generateTableType(table)).join('\n')}

    ${language === 'javascript' ? generateJSDocImportTypes(tables) : ''}

    const links = ${JSON.stringify(links)};

    export class XataClient extends BaseClient<{
      ${tables.map((table) => `"${table.name}": Repository<${getTypeName(table.name)}>;`).join('\n')}
    }> {
      constructor(options?: XataClientOptions) {
        super({ databaseURL: "${databaseUrl}", ...options}, links);

        const factory = options?.repositoryFactory || new RestRespositoryFactory();
        ${language === 'javascript' ? generateJSDocInternalType(tables) : ''}
        this.db = {
          ${tables.map((table) => `"${table.name}": factory.createRepository(this, "${table.name}"),`).join('\n')}
        };
      }
    }
  `;

  const transpiled = transpile(code, language, javascriptTarget);
  const declarations = emitDeclarations(code);

  const pretty = prettier.format(transpiled, { parser, plugins: [parserTypeScript, parserJavascript] });

  return { original: code, transpiled: pretty, declarations };
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

function emitDeclarations(code: string) {
  const files = new Map<string, string>();
  const inputFileName = 'index.ts';
  const sourceFile = ts.createSourceFile(inputFileName, code, ts.ScriptTarget.ESNext);

  const compilerHost = {
    getSourceFile: (fileName: string) => (fileName === inputFileName ? sourceFile : undefined),
    // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
    writeFile: (_name: string, _text: string) => {},
    getDefaultLibFileName: () => 'lib.d.ts',
    useCaseSensitiveFileNames: () => false,
    getCanonicalFileName: (fileName: string) => fileName,
    getCurrentDirectory: () => '',
    getNewLine: () => '\n',
    fileExists: (fileName: string) => fileName === inputFileName,
    readFile: () => '',
    directoryExists: () => true,
    getDirectories: () => []
  };

  const program = ts.createProgram(['index.ts'], { declaration: true, emitDeclarationOnly: true }, compilerHost);
  program.emit(undefined, (fileName, data) => files.set(fileName, data), undefined, true);

  return files.get('index.d.ts');
}

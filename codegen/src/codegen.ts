import pluralize from 'pluralize';
import ts from 'typescript';
import prettier, { BuiltInParserName } from 'prettier';
import parserJavascript from 'prettier/parser-babel.js';
import parserTypeScript from 'prettier/parser-typescript.js';
import { Column, Table, XataDatabaseSchema } from './schema.js';

export type GenerateOptions = {
  schema: XataDatabaseSchema;
  databaseURL: string;
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

function generateTableTypes(tables: Table[]) {
  const types = tables.map((table) => {
    const { columns } = table;
    const revLinks: { table: string }[] = []; // table.rev_links || [];

    return `export interface ${getTypeName(table.name)} {
    ${columns.map((column) => generateColumnType(column)).join('\n')}
    ${revLinks.map((link) => `${link.table}: Query<${getTypeName(link.table)}>`).join('\n')}
  };

  export type ${getTypeName(table.name)}Record = ${getTypeName(table.name)} & XataRecord;
  `;
  });

  const schema = `export type DatabaseSchema = {
    ${tables.map((table) => `${table.name}: ${getTypeName(table.name)};`).join('\n')}
  }`;

  return [...types, schema].join('\n');
}

function generateColumnType(column: Column) {
  return `${column.name}?: ${getTypeScriptType(column)} | null`;
}

function generateAbstractClient(language: Language) {
  switch (language) {
    case 'typescript':
      return `
        const DatabaseClient = buildClient<DatabaseSchema>();`;
    case 'javascript':
      return `
        /** @typedef { import('./types').DatabaseSchema } DatabaseSchema */
        /** @type { import('@xata.io/client').WrapperConstructor<DatabaseSchema> } */
        const DatabaseClient = buildClient();`;
    default:
      return '';
  }
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
  databaseURL,
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
      buildClient,
      BaseClientOptions,
      XataRecord
    } from '@xata.io/client';

    ${generateTableTypes(tables)}

    const links = ${JSON.stringify(links)};

    ${generateAbstractClient(language)}

    export class XataClient extends DatabaseClient {
      constructor(options?: BaseClientOptions) {
        super({ databaseURL: "${databaseURL}", ...options}, links);
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

  const program = ts.createProgram(
    ['index.ts'],
    { declaration: true, emitDeclarationOnly: true, removeComments: true },
    compilerHost
  );
  program.emit(undefined, (fileName, data) => files.set(fileName, data), undefined, true);

  return files.get('index.d.ts');
}

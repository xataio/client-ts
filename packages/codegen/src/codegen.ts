import Case from 'case';
import prettier, { BuiltInParserName } from 'prettier';
import * as parserJavascript from 'prettier/parser-babel.js';
import * as parserTypeScript from 'prettier/parser-typescript.js';
import ts from 'typescript';
import { XataDatabaseSchema } from './schema';

export type GenerateOptions = {
  schema: XataDatabaseSchema;
  databaseURL: string;
  language: Language;
  javascriptTarget?: JavascriptTarget;
  branch?: string;
};

export type GenerateOutput = {
  original: string;
  transpiled: string;
  declarations?: string;
};

export type Language = 'typescript' | 'javascript';
export type JavascriptTarget = keyof typeof ts.ScriptTarget | undefined;

function getTypeName(tableName: string) {
  const name = Case.pascal(tableName);

  // If table starts with a number, prepend a $ sign
  if (name.match(/^\d/)) return `$${name}`;

  return name;
}

export async function generate({
  schema,
  databaseURL,
  language,
  javascriptTarget,
  branch
}: GenerateOptions): Promise<GenerateOutput> {
  const { tables } = schema;

  const parser = prettierParsers[language];

  const defaultOptions: Record<string, unknown> = {
    databaseURL,
    branch
  };

  const code = `
    import { BaseClientOptions, buildClient, SchemaInference, XataRecord } from '@xata.io/client';

    ${
      language === 'javascript'
        ? `/** @typedef { import('./types').SchemaTables } SchemaTables */
           /** @type { SchemaTables } */`
        : ''
    }
    const tables = ${JSON.stringify(tables)} as const;

    export type SchemaTables = typeof tables;
    export type DatabaseSchema = SchemaInference<SchemaTables>;

    ${tables
      .map(
        (table) =>
          `
            export type ${getTypeName(table.name)} = DatabaseSchema['${table.name}'];
            export type ${getTypeName(table.name)}Record = ${getTypeName(table.name)} & XataRecord;
          `
      )
      .join('\n')}

    ${language === 'javascript' ? `/** @type { import('@xata.io/client').ClientConstructor<{}> } */` : ''}
    const DatabaseClient = buildClient();

    const defaultOptions = ${JSON.stringify(defaultOptions)};

    ${language === 'javascript' ? `/** @extends DatabaseClient<SchemaTables> */` : ''}
    export class XataClient extends DatabaseClient<SchemaTables> {
      constructor(options?: BaseClientOptions) {
        super({ ...defaultOptions, ...options}, tables);
      }
    }

    let instance: XataClient | undefined = undefined;
    export const getXataClient = () => {
      if (instance) return instance;

      instance = new XataClient();
      return instance;
    };
  `;

  const transpiled = transpile(code, language, javascriptTarget);
  const declarations = emitDeclarations(code);

  const pretty = prettier.format(transpiled, { parser, plugins: [parserTypeScript, parserJavascript] });

  const prettyDeclarations = declarations
    ? prettier.format(declarations, { parser: 'typescript', plugins: [parserTypeScript] })
    : undefined;

  return { original: code, transpiled: pretty, declarations: prettyDeclarations };
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

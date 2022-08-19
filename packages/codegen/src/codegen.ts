import Case from 'case';
import prettier, { BuiltInParserName } from 'prettier';
import * as parserJavascript from 'prettier/parser-babel.js';
import * as parserTypeScript from 'prettier/parser-typescript.js';
import ts from 'typescript';
import { XataDatabaseSchema } from './schema';
import { VERSION } from './version';

export type GenerateOptions = {
  schema: XataDatabaseSchema;
  databaseURL: string;
  language: Language;
  moduleType?: ModuleType;
  javascriptTarget?: JavascriptTarget;
  branch?: string;
  includeWorkers?: boolean;
};

export type GenerateOutput = {
  original: string;
  transpiled: string;
  declarations?: string;
};

export type Language = 'typescript' | 'javascript';
export type ModuleType = 'esm' | 'cjs';
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
  moduleType,
  javascriptTarget,
  branch,
  includeWorkers
}: GenerateOptions): Promise<GenerateOutput> {
  const { tables } = schema;

  const parser = prettierParsers[language];

  const defaultOptions: Record<string, unknown> = {
    databaseURL,
    branch
  };

  const imports =
    language === 'javascript' && moduleType === 'cjs'
      ? `
    const { BaseClientOptions, buildClient, ${
      includeWorkers ? 'buildWorkerRunner, ' : ''
    } SchemaInference, XataRecord } = require('@xata.io/client');
  `
      : `
    import { BaseClientOptions, buildClient, ${
      includeWorkers ? 'buildWorkerRunner, ' : ''
    } SchemaInference, XataRecord } from '@xata.io/client';
  `;

  const code = `
    // Generated by Xata Codegen ${VERSION}. Please do not edit.
    ${imports.trim()}
    
    ${
      language === 'javascript'
        ? `/** @typedef { import('./types').SchemaTables } SchemaTables */
           /** @type { SchemaTables } */`
        : ''
    }
    const tables = ${JSON.stringify(tables)} as const;

    export type SchemaTables = typeof tables;
    export type InferredTypes = SchemaInference<SchemaTables>;

    ${tables
      .map(
        (table) =>
          `
            export type ${getTypeName(table.name)} = InferredTypes['${table.name}'];
            export type ${getTypeName(table.name)}Record = ${getTypeName(table.name)} & XataRecord;
          `
      )
      .join('\n')}

    export type DatabaseSchema = {
      ${tables.map((table) => `'${table.name}': ${getTypeName(table.name)}Record`).join(',\n')}
    };

    ${language === 'javascript' ? `/** @type { import('@xata.io/client').ClientConstructor<{}> } */` : ''}
    const DatabaseClient = buildClient();

    const defaultOptions = ${JSON.stringify(defaultOptions)};

    ${language === 'javascript' ? `/** @typedef { import('./types').DatabaseSchema } DatabaseSchema */` : ''}
    ${language === 'javascript' ? `/** @extends DatabaseClient<DatabaseSchema> */` : ''}
    export class XataClient extends DatabaseClient<DatabaseSchema> {
      constructor(options?: BaseClientOptions) {
        super({ ...defaultOptions, ...options}, tables);
      }
    }

    let instance: XataClient | undefined = undefined;

    ${language === 'javascript' ? `/** @type { () => XataClient } */` : ''}
    export const getXataClient = () => {
      if (instance) return instance;

      instance = new XataClient();
      return instance;
    };

    ${
      includeWorkers
        ? `
      export const xataWorker = buildWorkerRunner<XataClient>({
        workspace: '<your-workspace-slug>',
        worker: "<your-workspace-id>",
      });`
        : ''
    }
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

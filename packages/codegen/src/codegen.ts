import Case from 'case';
import prettier from 'prettier';
import * as parserJavascript from 'prettier/parser-babel.js';
import * as parserTypeScript from 'prettier/parser-typescript.js';
import { Project, VariableDeclarationKind } from 'ts-morph';
import ts from 'typescript';
import { XataDatabaseSchema } from './schema';

export type GenerateOptions = {
  schema: XataDatabaseSchema;
  language: Language;
  moduleType?: ModuleType;
  javascriptTarget?: JavascriptTarget;
  existingCode?: string;
};

export type GenerateOutput = {
  original: string;
  transpiled: string;
  declarations?: string;
};

export type Language = 'typescript' | 'javascript';
export type ModuleType = 'esm' | 'cjs' | 'deno' | 'vite';
export type JavascriptTarget = keyof typeof ts.ScriptTarget | undefined;

export function isValidJavascriptTarget(target?: string): target is JavascriptTarget {
  return target !== undefined && target in ts.ScriptTarget;
}

// Enum.keys() returns 2x the number of keys
export const javascriptTargets = Object.keys(ts.ScriptTarget).slice(Object.keys(ts.ScriptTarget).length / 2);

function getTypeName(tableName: string) {
  const name = Case.pascal(tableName);

  // If table starts with a number, prepend a $ sign
  if (name.match(/^\d/)) return `$${name}`;

  return name;
}

export async function generate({
  language,
  moduleType = 'esm',
  javascriptTarget,
  schema,
  existingCode
}: GenerateOptions) {
  // For now don't read external fs or tsconfig.json
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      module: moduleType === 'cjs' ? ts.ModuleKind.CommonJS : ts.ModuleKind.ESNext,
      target: ts.ScriptTarget[javascriptTarget ?? 'ES2020']
    }
  });

  const sourceFile = project.createSourceFile('xata.ts', existingCode);

  const packageName = moduleType === 'deno' ? 'npm:@xata.io/client@latest' : '@xata.io/client';
  const packageImports = ['buildClient', 'getDeployPreviewBranch'];
  const typeImports = ['SchemaInference', 'XataRecord'];

  const importDeclarations = sourceFile
    .getImportDeclarations()
    .filter((i) => i.getModuleSpecifierValue() === packageName);

  const namedImports = importDeclarations.flatMap((i) => i.getNamedImports());
  for (const namedImport of namedImports) {
    if (packageImports.includes(namedImport.getName())) {
      namedImport.remove();
    } else if (typeImports.includes(namedImport.getName())) {
      namedImport.remove();
    }
  }

  for (const importDeclaration of importDeclarations) {
    if (importDeclaration.getNamedImports().length === 0) {
      importDeclaration.remove();
    }
  }

  // Add module imports
  const sdkImport = sourceFile.getImportDeclaration(
    (i) => i.getModuleSpecifierValue() === packageName && !i.isTypeOnly()
  );

  if (!sdkImport) {
    sourceFile.addImportDeclaration({ namedImports: packageImports, moduleSpecifier: packageName });
  } else {
    const namedImports = new Set([...sdkImport.getNamedImports().map((i) => i.getName()), ...packageImports]);
    sdkImport.removeNamedImports();
    sdkImport.addNamedImports([...namedImports]);
  }

  // Add type imports
  const typesImport = sourceFile.getImportDeclaration(
    (i) => i.getModuleSpecifierValue() === packageName && i.isTypeOnly()
  );

  if (!typesImport) {
    sourceFile.addImportDeclaration({
      namedImports: typeImports,
      moduleSpecifier: packageName,
      isTypeOnly: true,
      trailingTrivia: '\n'
    });
  } else {
    const namedImports = new Set([...typesImport.getNamedImports().map((i) => i.getName()), ...typeImports]);
    typesImport.removeNamedImports();
    typesImport.addNamedImports([...namedImports]);
  }

  // Add tables schema
  const tablesList = sourceFile.getVariableDeclaration('tables');
  const tablesListContent = `${JSON.stringify(schema.tables)} as const`;

  if (!tablesList) {
    sourceFile.addVariableStatement({
      declarationKind: VariableDeclarationKind.Const,
      declarations: [{ name: 'tables', initializer: tablesListContent }],
      leadingTrivia:
        language === 'javascript'
          ? `/** @typedef { import('./types').SchemaTables } SchemaTables */
             /** @type { SchemaTables } */\n`
          : undefined,
      trailingTrivia: '\n'
    });
  } else {
    tablesList.setInitializer(tablesListContent);
  }

  // Add schema tables types
  const schemaTables = sourceFile.getTypeAlias('SchemaTables');
  const schemaTablesContent = `typeof tables`;

  if (!schemaTables) {
    sourceFile.addTypeAlias({ name: 'SchemaTables', type: schemaTablesContent, isExported: true });
  } else {
    schemaTables.setType(schemaTablesContent);
  }

  // Add inferred types
  const inferredTypes = sourceFile.getTypeAlias('InferredTypes');
  const inferredTypesContent = `SchemaInference<SchemaTables>`;

  if (!inferredTypes) {
    sourceFile.addTypeAlias({
      name: 'InferredTypes',
      type: inferredTypesContent,
      isExported: true,
      trailingTrivia: '\n'
    });
  } else {
    inferredTypes.setType(inferredTypesContent);
  }

  // Remove existing schema types
  const existingSchemaTypes = sourceFile.getTypeAliases().filter((t) => t.getName().endsWith('Record'));
  for (const type of existingSchemaTypes) {
    sourceFile.getTypeAlias(type.getName().replace(/Record$/, ''))?.remove();
    type.remove();
  }

  // Add schema types
  for (const table of schema.tables) {
    const typeName = getTypeName(table.name);

    sourceFile.addTypeAlias({
      name: typeName,
      type: `InferredTypes['${table.name}']`,
      isExported: true,
      leadingTrivia: '\n'
    });

    sourceFile.addTypeAlias({
      name: `${typeName}Record`,
      type: `${typeName} & XataRecord`,
      isExported: true
    });
  }

  // Add database schema generic type
  const databaseSchema = sourceFile.getTypeAlias('DatabaseSchema');
  const databaseSchemaContent = `{
    ${schema.tables.map((table) => `'${table.name}': ${getTypeName(table.name)}Record`).join(',\n')}
  }`;

  if (!databaseSchema) {
    sourceFile.addTypeAlias({
      name: 'DatabaseSchema',
      type: databaseSchemaContent,
      isExported: true,
      leadingTrivia: '\n'
    });
  } else {
    databaseSchema.setType(databaseSchemaContent);
  }

  // Add database client builder
  const databaseClient = sourceFile.getVariableDeclaration('DatabaseClient');
  const databaseClientContent = `buildClient()`;

  if (!databaseClient) {
    sourceFile.addVariableStatement({
      declarationKind: VariableDeclarationKind.Const,
      declarations: [{ name: 'DatabaseClient', initializer: databaseClientContent }],
      leadingTrivia:
        language === 'javascript' ? `\n/** @type { import('@xata.io/client').ClientConstructor<{}> } */\n` : undefined,
      trailingTrivia: '\n'
    });
  } else {
    databaseClient.setInitializer(databaseClientContent);
  }

  // Add XataClient class if doesn't exist already
  if (!sourceFile.getClass('XataClient')) {
    sourceFile.addClass({
      name: 'XataClient',
      extends: 'DatabaseClient<DatabaseSchema>',
      isExported: true,
      leadingTrivia:
        language === 'javascript'
          ? `/** @typedef { import('./types').DatabaseSchema } DatabaseSchema */
               /** @extends DatabaseClient<DatabaseSchema> */\n`
          : undefined,
      ctors: [
        {
          parameters: [],
          statements: `super({ 
            apiKey: ${envVariable(moduleType, 'XATA_API_KEY')},
            databaseURL: ${envVariable(moduleType, 'XATA_DATABASE_URL')},
            // Use deploy preview branch if available, otherwise use branch from environment
            branch: getDeployPreviewBranch(${envLoader(moduleType)}) ?? ${envVariable(
            moduleType,
            'XATA_BRANCH'
          )} ?? 'main'
           }, tables);`
        }
      ]
    });
  }

  sourceFile.saveSync();
  project.emitSync();

  const typescript = prettier.format(sourceFile.getFullText(), {
    parser: 'typescript',
    plugins: [parserTypeScript]
  });

  const javascript = prettier.format(project.getFileSystem().readFileSync('xata.js'), {
    parser: 'babel',
    plugins: [parserJavascript]
  });

  const rawDeclarations = emitDeclarations(typescript);
  const types = rawDeclarations
    ? prettier.format(rawDeclarations, {
        parser: 'typescript',
        plugins: [parserTypeScript]
      })
    : undefined;

  return { typescript, javascript, types };
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

function envLoader(module: ModuleType) {
  switch (module) {
    case 'cjs':
    case 'esm':
      return `process.env`;
    case 'deno':
      return `Deno.env.get`;
    case 'vite':
      return `import.meta.env`;
  }
}

function envVariable(module: ModuleType, variable: string) {
  switch (module) {
    case 'cjs':
    case 'esm':
      return `process.env.${variable}`;
    case 'deno':
      return `Deno.env.get("${variable}")`;
    case 'vite':
      return `import.meta.env.${variable}`;
  }
}

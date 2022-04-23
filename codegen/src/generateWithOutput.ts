import * as fs from 'fs/promises';
import { Ora } from 'ora';
import * as path from 'path';
import { join, relative } from 'path';
import { ZodError } from 'zod';
import { generate, Language } from './codegen.js';
import { parseConfigFile } from './config.js';
import { errors } from './errors.js';
import { parseSchemaFile } from './schema.js';

export interface GenerateWithOutputOptions {
  spinner?: Ora;
  xataDirectory: string;
  outputFilePath: string;
  writeFile?: typeof fs.writeFile;
}

export const generateWithOutput = async ({
  outputFilePath,
  xataDirectory,
  spinner,
  writeFile = fs.writeFile
}: GenerateWithOutputOptions) => {
  if (spinner) spinner.text = 'Found schema, generating...';

  const fullOutputPath = path.resolve(process.cwd(), outputFilePath);
  const [extension] = fullOutputPath.split('.').slice(-1);

  if (!isExtensionValid(extension)) {
    throw new Error(errors.invalidCodegenOutputExtension);
  }

  let schema: ReturnType<typeof parseSchemaFile>;
  let config: ReturnType<typeof parseConfigFile>;
  try {
    const schemaFile = join(xataDirectory, 'schema.json');
    const rawSchema = await readFileOrExit(schemaFile, 'schema');
    schema = parseSchemaFile(rawSchema);
  } catch (err) {
    handleParsingError('The content of the schema file is not valid:', err);
    return;
  }

  try {
    const configFile = join(xataDirectory, 'config.json');
    const rawConfig = await readFileOrExit(configFile, 'config');
    config = parseConfigFile(rawConfig);
  } catch (err) {
    handleParsingError('The content of the config file is not valid:', err);
    return;
  }

  const language = getLanguageFromExtension(extension);

  const code = await generate({ schema, config, language });
  await writeFile(fullOutputPath, code);

  spinner?.succeed(`Your XataClient is generated at ./${relative(process.cwd(), outputFilePath)}.`);
};

const isExtensionValid = (extension: string): extension is 'js' | 'ts' => ['ts', 'js'].includes(extension);

const handleParsingError = (message: string, err: unknown) => {
  console.error(message);

  if (err instanceof Error) {
    console.error(err);
  } else if (err instanceof ZodError) {
    for (const error of err.errors) {
      console.error(`  [${error.code}]`, error.message, 'at', `"${error.path.join('.')}"`);
    }
  }
  process.exit(1);
};

const getLanguageFromExtension = (extension?: 'ts' | 'js'): Language => {
  switch (extension) {
    case 'js':
      return 'javascript';
    case 'ts':
    case undefined:
      return 'typescript';
    default:
      throw new Error(errors.invalidCodegenOutputExtension);
  }
};

const readFileOrExit = async (fullPath: string, type: string) => {
  try {
    return await fs.readFile(fullPath, 'utf-8');
  } catch (err) {
    console.error(`Could not read ${type} file at`, fullPath);
    process.exit(1);
  }
};

import * as fs from 'fs/promises';
import { Ora } from 'ora';
import * as path from 'path';
import { join, relative } from 'path';
import { generate } from './codegen.js';
import { errors } from './errors.js';
import { getLanguageFromExtension } from './getLanguageFromExtension.js';
import { parseConfigFile } from './config.js';
import { parseSchemaFile } from './schema.js';
import { readFile } from './readFile.js';
import { ZodError } from 'zod';

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

  const schemaFile = join(xataDirectory, 'schema.json');
  const configFile = join(xataDirectory, 'config.json');
  const rawSchema = await readFile({ fullPath: schemaFile, type: 'schema' });
  const rawConfig = await readFile({ fullPath: configFile, type: 'config' });

  let schema: ReturnType<typeof parseSchemaFile>;
  let config: ReturnType<typeof parseConfigFile>;
  try {
    schema = parseSchemaFile(rawSchema);
  } catch (err) {
    handleParsingError('The content of the schema file is not valid:', err);
    return;
  }
  try {
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

export const isExtensionValid = (extension: string): extension is 'js' | 'ts' => ['ts', 'js'].includes(extension);

export const handleParsingError = (message: string, err: unknown) => {
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

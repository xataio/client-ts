import * as fs from 'fs/promises';
import { Ora } from 'ora';
import * as path from 'path';
import { join, relative } from 'path';
import { generate } from './codegen.js';
import { errors } from './errors.js';
import { getLanguageFromExtension } from './getLanguageFromExtension.js';
import { parseConfigFile } from './parseConfigFile.js';
import { parseSchemaFile } from './parseSchemaFile.js';
import { readFile } from './readFile.js';

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
  const schema = parseSchemaFile(rawSchema);
  const config = parseConfigFile(rawConfig);
  const language = getLanguageFromExtension(extension);

  const code = await generate({ schema, config, language });
  await writeFile(fullOutputPath, code);

  spinner?.succeed(`Your XataClient is generated at ./${relative(process.cwd(), outputFilePath)}.`);
};

export const isExtensionValid = (extension: string): extension is 'js' | 'ts' => ['ts', 'js'].includes(extension);

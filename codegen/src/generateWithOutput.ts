import { Ora } from 'ora';
import * as path from 'path';
import { join, relative } from 'path';
import { generate } from './codegen';
import { errors } from './errors';
import { getLanguageFromExtension } from './getLanguageFromExtension';
import { isExtensionValid } from './isExtensionValid';
import { parseConfigFile } from './parseConfigFile';
import { parseSchemaFile } from './parseSchemaFile';
import { readFile } from './readFile';
import * as fs from 'fs/promises';

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

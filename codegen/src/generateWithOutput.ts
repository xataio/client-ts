import * as fs from 'fs/promises';
import { Ora } from 'ora';
import * as path from 'path';
import { join, relative } from 'path';
import { ZodError } from 'zod';
import { generate, Language } from './codegen.js';
import { parseConfigFile } from './config.js';
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

  const language = getLanguageFromExtension(extension);

  let schema: ReturnType<typeof parseSchemaFile>;
  let config: ReturnType<typeof parseConfigFile>;
  try {
    const schemaFile = join(xataDirectory, 'schema.json');
    const rawSchema = await readFile(schemaFile, 'schema');
    schema = parseSchemaFile(rawSchema);
  } catch (err) {
    handleParsingError('The content of the schema file is not valid:', err);
    return;
  }

  try {
    const configFile = join(xataDirectory, 'config.json');
    const rawConfig = await readFile(configFile, 'config');
    config = parseConfigFile(rawConfig);
  } catch (err) {
    handleParsingError('The content of the config file is not valid:', err);
    return;
  }

  const code = await generate({ schema, config, language });
  await writeFile(fullOutputPath, code);

  spinner?.succeed(`Your XataClient is generated at ./${relative(process.cwd(), outputFilePath)}.`);
};

const handleParsingError = (message: string, err: unknown) => {
  console.error(message);

  if (err instanceof ZodError) {
    for (const error of err.errors) {
      console.error(`  [${error.code}]`, error.message, 'at', `"${error.path.join('.')}"`);
    }
    process.exit(1);
  }
  throw err;
};

const getLanguageFromExtension = (extension?: string): Language => {
  switch (extension) {
    case 'js':
      return 'javascript';
    case 'ts':
    case undefined:
      return 'typescript';
    default:
      throw new Error(`You've specified an invalid extension in your output parameter. We can generate code for files in JavaScript (ending with .js), or TypeScript (ending with .ts). Please adjust your output argument.

      More in the docs: https://github.com/xataio/client-ts#readme
      `);
  }
};

const readFile = async (fullPath: string, type: string) => {
  try {
    return await fs.readFile(fullPath, 'utf-8');
  } catch (err) {
    throw new Error(`Could not read ${type} file at ${fullPath}`);
  }
};

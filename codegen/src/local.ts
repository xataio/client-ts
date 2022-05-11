import chalk from 'chalk';
import * as fs from 'fs/promises';
import { join } from 'path';
import { ZodError } from 'zod';
import { parseConfigFile } from './config.js';
import { exitWithError } from './errors.js';
import { generateWithOutput } from './generateWithOutput.js';
import { parseSchemaFile } from './schema.js';
import { spinner } from './spinner.js';

export async function generateFromLocalFiles(xataDirectory: string, out: string) {
  const schemaFile = join(xataDirectory, 'schema.json');
  try {
    await fs.access(schemaFile); // Make sure the schema file exists
  } catch (e: any) {
    if (e.code !== 'ENOENT') exitWithError(e);
    spinner.info(
      `You need to first install the Xata CLI and create a new database or pull the schema of an existing one. To learn more, visit ${chalk.blueBright(
        'https://docs.xata.io/cli/getting-started'
      )}.
  `
    );
    exitWithError('No local Xata schema found.');
    return;
  }

  const schema = await getLocalSchema(xataDirectory);
  const databaseUrl = await getLocalDatabaseUrl(xataDirectory);

  try {
    await generateWithOutput({ schema, databaseUrl, outputFilePath: out, spinner });
  } catch (e) {
    exitWithError(e);
  }
}

export async function getLocalSchema(xataDirectory: string) {
  try {
    const schemaFile = join(xataDirectory, 'schema.json');
    const rawSchema = await readFile(schemaFile, 'schema');
    return parseSchemaFile(rawSchema);
  } catch (err) {
    handleParsingError('The content of the schema file is not valid:', err);
    throw err;
  }
}

export async function getLocalDatabaseUrl(xataDirectory: string) {
  try {
    const configFile = join(xataDirectory, 'config.json');
    const rawConfig = await readFile(configFile, 'config');
    const config = parseConfigFile(rawConfig);
    return `https://${config.workspaceID}.xata.sh/db/${config.dbName}`;
  } catch (err) {
    handleParsingError('The content of the config file is not valid:', err);
    throw err;
  }
}

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

const readFile = async (fullPath: string, type: string) => {
  try {
    return await fs.readFile(fullPath, 'utf-8');
  } catch (err) {
    throw new Error(`Could not read ${type} file at ${fullPath}`);
  }
};

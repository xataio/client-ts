import chalk from 'chalk';
import { program } from 'commander';
import { access, mkdir } from 'fs/promises';
import inquirer from 'inquirer';
import ora from 'ora';
import { join, dirname } from 'path';
import { checkIfCliInstalled } from './checkIfCliInstalled.js';
import { cliPath } from './cliPath.js';
import { generateWithOutput } from './generateWithOutput.js';
import { getCli } from './getCli.js';
import { handleXataCliRejection } from './handleXataCliRejection.js';
import { useCli } from './useCli.js';
import { CODEGEN_VERSION } from './version.js';

const defaultXataDirectory = join(process.cwd(), 'xata');
const defaultOutputFile = join(process.cwd(), 'src', 'xata.ts');
const spinner = ora();

program
  .name('xata-codegen')
  .description('The Xata SDK CLI is used to generate type-safe and predictable clients used to interact with Xata.')
  .version(CODEGEN_VERSION)
  .argument(
    '[xata directory]',
    `A path to your local Xata directory. If you don't have one, run 'xata init' or 'xata pull' first with the xata CLI https://github.com/xataio/cli`,
    defaultXataDirectory
  )
  .option('-o, --out <path>', 'A path to store your generated API client.', defaultOutputFile)
  .action(async (xataDirectory, { out }) => {
    const schema = join(xataDirectory, 'schema.json');
    spinner.start('Checking schema...');

    try {
      await access(schema); // Make sure the schema file exists
    } catch (e: any) {
      if (e.code !== 'ENOENT') exitWithError(e);
      await pullSchema();
    }

    try {
      const dir = dirname(out);
      await mkdir(dir, { recursive: true });
      await generateWithOutput({ xataDirectory, outputFilePath: out, spinner });
    } catch (e) {
      exitWithError(e);
    }
  });

program.parse();

async function pullSchema() {
  spinner.warn('No local Xata schema found.');
  const { shouldUseCli } = await inquirer.prompt([
    {
      name: 'shouldUseCli',
      message: 'Would you like to use the Xata CLI to pull an existing database schema?',
      type: 'confirm'
    }
  ]);

  if (!shouldUseCli) {
    handleXataCliRejection(spinner);
    return;
  }

  spinner.text = 'Checking for Xata CLI...';
  const hasCli = await checkIfCliInstalled();

  try {
    if (!hasCli) {
      await getCli({ spinner });
    }

    await useCli({ command: hasCli ? 'xata' : cliPath, spinner });
  } catch (e: any) {
    if (e.message.includes('ENOTFOUND') || e.message.includes('ENOENT')) {
      exitWithError(
        `We tried to download the Xata CLI to clone your database locally, but failed because of internet connectivity issues.

To try to clone your database locally yourself, visit ${chalk.blueBright(
          'https://docs.xata.io/cli/getting-started'
        )}, and then rerun the code generator. We apologize for the inconvenience.

If you'd like to open an issue, please do so at ${chalk.blueBright('https://github.com/xataio/client-ts')}.
`
      );
    }
    exitWithError(e);
  }
}

function exitWithError(err: unknown) {
  spinner.fail(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

import chalk from 'chalk';
import { program } from 'commander';
import { access, mkdir } from 'fs/promises';
import ora from 'ora';
import { dirname, join } from 'path';
import { generateWithOutput } from './generateWithOutput.js';
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
      spinner.info(
        `You need to first install the Xata CLI and create a new database or pull the schema of an existing one. To learn more, visit ${chalk.blueBright(
          'https://docs.xata.io/cli/getting-started'
        )}.
    `
      );
      exitWithError('No local Xata schema found.');
      return;
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

function exitWithError(err: unknown) {
  spinner.fail(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

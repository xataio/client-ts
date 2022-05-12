import { program } from 'commander';
import { run } from './cli-run.js';
import { SHELL_VERSION } from './version.js';

program
  .name('xata-shell')
  .description('Shell for xata.io')
  .version(SHELL_VERSION)
  .option('-e, --env <path>', 'Path to the .env file to load.', '.env')
  .action(run);

program.parse();

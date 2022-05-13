import { program } from 'commander';
import { run } from './cli-run.js';
import { SHELL_VERSION } from './version.js';

program
  .name('xata-shell')
  .description('Shell for xata.io')
  .version(SHELL_VERSION)
  .option('--env <path>', 'Path to the .env file to load.', '.env')
  .option('--databaseURL <url>', 'Database URL that contains the workspace and database information.')
  .option('--apiKey <key>', 'API key to use to fetch the database schema from xata.io')
  .action(run);

program.parse();

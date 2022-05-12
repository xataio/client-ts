import { program } from 'commander';
import { run } from './cli-run.js';
// import { IMPORTER_VERSION } from './version.js';

program
  .name('xata-shell')
  .description('Shell for xata.io')
  // .version(IMPORTER_VERSION)
  .action(run);

program.parse();

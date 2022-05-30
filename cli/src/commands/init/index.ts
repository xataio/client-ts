import { Flags } from '@oclif/core';
import { getBranchMigrationPlan, getCurrentBranchName } from '@xata.io/client';
import chalk from 'chalk';
import { spawn } from 'child_process';
import { access, readFile, writeFile } from 'fs/promises';
import path from 'path';
import prompts from 'prompts';
import which from 'which';
import { BaseCommand } from '../../base.js';
import { readAPIKey } from '../../key.js';
import { xataDatabaseSchema } from '../../schema.js';
import Codegen from '../codegen/index.js';
import EditSchema from '../schema/edit.js';

export default class Init extends BaseCommand {
  static description = 'Configure your working directory to work with a Xata database';

  static examples = [];

  static flags = {
    databaseURL: this.databaseURLFlag,
    schema: Flags.string({
      description: 'Initializes a new database or updates an existing one with the given schema'
    }),
    force: Flags.boolean({
      description: 'Overwrite existing project configuration'
    })
  };

  static args = [
    // TODO: add an arg for initial schema
  ];

  async run(): Promise<void> {
    const { flags } = await this.parse(Init);

    if (this.projectConfigLocation) {
      if (!flags.force) {
        this.error(
          `Project already configured at ${this.projectConfigLocation}. Use ${chalk.bold('--force')} to overwrite it`
        );
      } else {
        this.warn(`Will overwrite ${this.projectConfigLocation} because ${chalk.bold('--force')} is being used`);
      }
    }

    const { workspace, database, databaseURL } = await this.getParsedDatabaseURL(flags.databaseURL, true);

    this.projectConfig = { databaseURL };

    await this.installSDK();

    await this.writeConfig();

    await this.writeEnvFile();

    if (flags.schema) {
      // TODO: remove default value once the getCurrentBranchName() return type is fixed.
      // It actually always returns a string, but the typing is wrong.
      const branch = (await getCurrentBranchName()) || '';
      await this.deploySchema(workspace, database, branch, flags.schema);
    } else {
      await EditSchema.run([]);
    }

    await Codegen.runIfConfigured(this.projectConfig);

    this.log('Done. You are all set!');
  }

  async installSDK() {
    const { confirm } = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: 'Do you want to install the TypeScript/JavaScript SDK?',
      initial: true
    });
    if (!confirm) return;

    await this.installPackage('@xata.io/codegen');

    await this.configureCodegen();
  }

  async configureCodegen() {
    const { confirm } = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: 'Do you want to use the TypeScript/JavaScript code generator?',
      initial: true
    });
    if (!confirm) return;

    this.projectConfig = this.projectConfig || {};
    this.projectConfig.codegen = {};

    const { output } = await prompts({
      type: 'text',
      name: 'output',
      message: 'Choose where the output file for the code generator',
      initial: 'src/xata.ts'
    });
    if (!output) return this.error('You must provide an output file');

    this.projectConfig.codegen.output = output;

    if (!output.endsWith('.ts')) {
      const { declarations } = await prompts({
        type: 'confirm',
        name: 'declarations',
        message: 'Do you want to generate the TypeScript declarations?',
        initial: (prev) => !prev.endsWith('.ts')
      });

      if (declarations) {
        this.projectConfig.codegen.declarations = true;
      }
    }
  }

  async getPackageManager() {
    const packageManager = (await this.access('yarn.lock')) ? 'yarn' : 'npm';
    if (!which.sync(packageManager, { nothrow: true })) {
      this.error(
        `Looks like ${packageManager} is not installed or is not in the PATH. This made impossible to install the code generator`
      );
    }
    return packageManager;
  }

  async access(path: string) {
    try {
      await access(path);
      return true;
    } catch (err) {
      return false;
    }
  }

  async installPackage(pkg: string) {
    const command = await this.getPackageManager();
    const subcommand = command === 'yarn' ? 'add' : 'install';
    await this.runCommand(command, [subcommand, pkg]);
  }

  runCommand(command: string, args: string[]) {
    this.log(`Running ${command} ${args.join(' ')}`);
    return new Promise((resolve, reject) => {
      spawn(command, args, { stdio: 'inherit' }).on('exit', (code) => {
        if (code && code > 0) return reject(new Error('Command failed'));
        resolve(undefined);
      });
    });
  }

  async writeConfig() {
    // Reuse location when using --force
    if (!this.projectConfigLocation) {
      const { location } = await prompts({
        type: 'select',
        name: 'location',
        message: 'Select where to store your configuration',
        choices: this.searchPlaces.map((place) => ({ title: place, value: place }))
      });
      if (!location) return this.error('You must select a location for the configuration file');

      this.projectConfigLocation = path.join(process.cwd(), location);
    }
    await this.updateConfig();
  }

  async writeEnvFile() {
    // TODO: generate a database-scoped API key
    const apiKey = await readAPIKey();

    let content = '';
    try {
      // TODO: check if the file already contains the key and warn if it does
      content = await readFile('.env', 'utf-8');
    } catch (err) {
      // ignore
    }
    content += `\n\nXATA_API_KEY=${apiKey}`;
    await writeFile('.env', content);
  }

  async deploySchema(workspace: string, database: string, branch: string, file: string) {
    this.log('Reading schema file...');
    const schema = await this.parseSchema(file);
    const xata = await this.getXataClient();
    const plan = await xata.branches.getBranchMigrationPlan(workspace, database, branch, schema);

    const { newTables, removedTables, renamedTables, tableMigrations } = plan.migration;

    function isEmpty(obj?: object) {
      if (obj == null) return true;
      if (Array.isArray(obj)) return obj.length === 0;
      return Object.keys(obj).length === 0;
    }

    if (isEmpty(newTables) && isEmpty(removedTables) && isEmpty(renamedTables) && isEmpty(tableMigrations)) {
      this.log('Your schema is up to date');
    } else {
      this.printMigration(plan.migration);

      const { confirm } = await prompts({
        type: 'confirm',
        name: 'confirm',
        message: `Apply the above migration?`,
        initial: true
      });
      if (!confirm) return this.exit(1);

      await xata.branches.executeBranchMigrationPlan(workspace, database, branch, plan);
    }
  }

  printMigration(migration: Awaited<ReturnType<typeof getBranchMigrationPlan>>['migration']) {
    if (migration.title) {
      this.log(`* ${migration.title} [status: ${migration.status}]`);
    }
    if (migration.id) {
      this.log(`ID: ${migration.id}`);
    }
    if (migration.lastGitRevision) {
      this.log(`git commit sha: ${migration.lastGitRevision}`);
      if (migration.localChanges) {
        this.log(' + local changes');
      }
      this.log();
    }
    if (migration.createdAt) {
      this.log(`Date ${this.formatDate(migration.createdAt)}`);
    }

    if (migration.newTables) {
      for (const tableName of Object.keys(migration.newTables)) {
        this.log(` ${chalk.bgWhite.blue('CREATE table ')} ${tableName}`);
      }
    }

    if (migration.removedTables) {
      for (const tableName of Object.keys(migration.removedTables)) {
        this.log(` ${chalk.bgWhite.red('DELETE table ')} ${tableName}`);
      }
    }

    if (migration.renamedTables) {
      for (const tableName of Object.keys(migration.renamedTables)) {
        this.log(` ${chalk.bgWhite.blue('RENAME table ')} ${tableName}`);
      }
    }

    if (migration.tableMigrations) {
      for (const [tableName, tableMigration] of Object.entries(migration.tableMigrations)) {
        this.log(`Table ${tableName}:`);
        if (tableMigration.newColumns) {
          for (const columnName of Object.keys(tableMigration.newColumns)) {
            this.log(` ${chalk.bgWhite.blue('ADD column ')} ${columnName}`);
          }
        }
        if (tableMigration.removedColumns) {
          for (const columnName of Object.keys(tableMigration.removedColumns)) {
            this.log(` ${chalk.bgWhite.red('DELETE column ')} ${columnName}`);
          }
        }
        if (tableMigration.modifiedColumns) {
          for (const [, columnMigration] of Object.entries(tableMigration.modifiedColumns)) {
            this.log(` ${chalk.bgWhite.red('MODIFY column ')} ${columnMigration.old.name}`);
          }
        }
      }
    }
  }

  async parseSchema(file: string) {
    let content: any;
    try {
      content = JSON.parse(await readFile(file, 'utf-8'));
    } catch (err) {
      this.error(`Could not parse the schema file at ${file}. Either it does not exist or is not valid JSON`);
    }

    const schema = xataDatabaseSchema.safeParse(content);
    if (!schema.success) {
      this.warn(`The schema file is malformed`);
      this.printZodError(schema.error);
      return this.error(`Could not parse the schema file at ${file}`);
    }
    return schema.data;
  }
}

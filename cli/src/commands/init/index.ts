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
      await this.readAndDeploySchema(workspace, database, branch, flags.schema);
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

    await this.installPackage('@xata.io/client');

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

  async readAndDeploySchema(workspace: string, database: string, branch: string, file: string) {
    this.log('Reading schema file...');
    const schema = await this.parseSchema(file);
    await this.deploySchema(workspace, database, branch, schema);
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

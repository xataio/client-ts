import { Flags } from '@oclif/core';
import { XataApiClient } from '@xata.io/client';
import { spawn, spawnSync } from 'child_process';
import { access, readFile, writeFile } from 'fs/promises';
import path from 'path';
import prompts from 'prompts';
import which from 'which';
import { BaseCommand } from '../../base.js';

export default class Init extends BaseCommand {
  static description = 'Configure your working directory to work with a Xata database';

  static examples = [];

  static flags = {
    workspace: Flags.string({
      description: 'Workspace id'
    }),
    database: Flags.string({
      description: 'Database name'
    })
  };

  static args = [
    // TODO: add an arg for initial schema
  ];

  packageManager: 'npm' | 'yarn' | undefined;

  async run(): Promise<void> {
    const { flags } = await this.parse(Init);

    const xata = await this.getXataClient();

    const workspace = flags.workspace || (await this.chooseWorkspace(xata));
    const database = flags.database || (await this.chooseDatabase(xata, workspace));

    await this.installSDK();

    await this.editSchema();

    await this.runCodegen();

    await this.writeConfig();

    await this.writeEnvFile();

    this.log('Done. You are all set!');
  }

  async chooseWorkspace(xata: XataApiClient) {
    const workspaces = await xata.workspaces.getWorkspacesList();

    if (workspaces.workspaces.length === 0) {
      return this.error('No workspaces found, please create one first');
    } else if (workspaces.workspaces.length === 1) {
      const workspace = workspaces.workspaces[0].id;
      this.log(`You only have a workspace, using it by default: ${workspace}"`);
      return workspace;
    }

    const result = await prompts({
      type: 'select',
      name: 'workspace',
      message: 'Select the workspace for the database',
      choices: workspaces.workspaces.map((workspace) => ({
        title: workspace.name,
        description: workspace.id,
        value: workspace.id
      }))
    });

    return String(result.workspace);
  }

  async chooseDatabase(xata: XataApiClient, workspace: string) {
    const databases = await xata.databases.getDatabaseList(workspace);
    const dbs = databases.databases || [];

    if (dbs.length > 0) {
      const choices = dbs.map((db) => ({
        title: db.name,
        value: db.name
      }));

      const result = await prompts({
        type: 'select',
        name: 'database',
        message: dbs.length > 0 ? 'Select a database or create a new one' : 'Select a database',
        choices: [{ title: 'Create a new database', value: 'create' }].concat(choices)
      });

      const database = result.database;
      if (database !== 'create') return database;
    }

    const name = await prompts({
      type: 'text',
      name: 'name',
      message: 'New database name',
      initial: 'my-database' // TODO: current dir name
    });

    await xata.databases.createDatabase(workspace, name.name);

    return name.name;
  }

  async installSDK() {
    const result = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: 'Do you want to install the TypeScript/JavaScript SDK?',
      initial: true
    });
    if (!result.confirm) return;

    await this.installPackage('@xata.io/codegen');

    await this.configureCodegen();
  }

  async configureCodegen() {
    const result = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: 'Do you want to use the TypeScript/JavaScript code generator?',
      initial: true
    });
    if (!result.confirm) return;

    const config = await prompts([
      {
        type: 'text',
        name: 'output',
        message: 'Choose where the output file for the code generator',
        initial: 'src/xata.ts'
      },
      {
        type: 'confirm',
        name: 'declarations',
        message: 'Do you want to generate the TypeScript declarations?',
        initial: (prev) => !prev.endsWith('.ts')
      }
    ]);

    this.projectConfig = this.projectConfig || {};
    this.projectConfig.codegen = config;
  }

  async editSchema() {
    // TODO
  }

  async runCodegen() {
    // TODO
  }

  async getPackageManager() {
    if (this.packageManager) return this.packageManager;

    const packageManager = (await this.access('yarn.lock')) ? 'yarn' : 'npm';
    if (!which.sync(packageManager, { nothrow: true })) {
      this.error(
        `Looks like ${packageManager} is not installed or is not in the PATH. This made impossible to install the code generator`
      );
    }
    this.packageManager = packageManager;
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
    if (!this.projectConfig) return;

    const result = await prompts({
      type: 'select',
      name: 'place',
      message: 'Select where to store your configuration',
      choices: this.searchPlaces.map((place) => ({ title: place, value: place }))
    });

    if (result.place === 'package.json') {
      const content = JSON.parse(await readFile('package.json', 'utf8'));
      content.xata = this.projectConfig;
      await writeFile('package.json', JSON.stringify(content, null, 2));
    } else {
      await writeFile(result.place, JSON.stringify(this.projectConfig, null, 2));
    }
  }

  async writeEnvFile() {
    // TODO
  }
}

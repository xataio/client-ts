import { Flags } from '@oclif/core';
import { getCurrentBranchName } from '@xata.io/client';
import chalk from 'chalk';
import { spawn } from 'child_process';
import { access, readFile, writeFile } from 'fs/promises';
import path from 'path';
import prompts from 'prompts';
import which from 'which';
import { createAPIKeyThroughWebUI } from '../../auth-server.js';
import { BaseCommand } from '../../base.js';
import { getProfile } from '../../credentials.js';
import { xataDatabaseSchema } from '../../schema.js';
import Codegen from '../codegen/index.js';

export default class Init extends BaseCommand {
  static description = 'Configure your working directory to work with a Xata database';

  static examples = [];

  static flags = {
    ...this.databaseURLFlag,
    schema: Flags.string({
      description: 'Initializes a new database or updates an existing one with the given schema'
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Overwrite existing project configuration'
    })
  };

  static args = [];

  async run(): Promise<void> {
    const { flags } = await this.parse(Init);

    if (this.projectConfigLocation) {
      if (!flags.force) {
        this.error(
          `Project already configured at ${this.projectConfigLocation}. Use ${chalk.bold('--force')} to overwrite it`
        );
      } else {
        this.warn(`Will overwrite ${this.projectConfigLocation} because ${chalk.bold('--force')} is being used`);
        // Clean up the project ocnfiugration so the user is asked for workspace and database again
        this.projectConfig = undefined;
      }
    }

    const { workspace, database, databaseURL } = await this.getParsedDatabaseURL(flags.db, true);

    this.projectConfig = { databaseURL };

    await this.installSDK();

    await this.writeConfig();

    await this.writeEnvFile(workspace, database);

    if (flags.schema) {
      const branch = await getCurrentBranchName();
      await this.readAndDeploySchema(workspace, database, branch, flags.schema);
    }

    await Codegen.runIfConfigured(this.projectConfig);

    this.log(
      `You are all set! Run ${chalk.bold('xata browse')} to edit the schema via UI, or ${chalk.bold(
        'xata schema edit'
      )} to edit the schema in the shell.`
    );
  }

  async installSDK() {
    const { confirm } = await this.prompt({
      type: 'confirm',
      name: 'confirm',
      message: 'Do you want to install the TypeScript/JavaScript SDK?',
      initial: true
    });
    if (confirm === undefined) return this.exit(1);
    if (!confirm) return;

    await this.installPackage('@xata.io/client');

    await this.configureCodegen();
  }

  async configureCodegen() {
    const { confirm } = await this.prompt({
      type: 'confirm',
      name: 'confirm',
      message: 'Do you want to use the TypeScript/JavaScript code generator?',
      initial: true
    });
    if (confirm === undefined) return this.exit(1);
    if (!confirm) return;

    this.projectConfig = this.projectConfig || {};
    this.projectConfig.codegen = {};

    const { output } = await this.prompt({
      type: 'text',
      name: 'output',
      message: 'Choose where the output file for the code generator',
      initial: 'src/xata.ts'
    });
    if (!output) return this.error('You must provide an output file');

    this.projectConfig.codegen.output = output;

    if (!output.endsWith('.ts')) {
      const { declarations } = await this.prompt({
        type: 'confirm',
        name: 'declarations',
        message: 'Do you want to generate the TypeScript declarations?'
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
      this.projectConfigLocation = path.join(process.cwd(), this.searchPlaces[0]);
    }
    await this.updateConfig();
  }

  async writeEnvFile(workspace: string, database: string) {
    // TODO: generate a database-scoped API key
    let apiKey = (await getProfile())?.apiKey;

    if (!apiKey) {
      apiKey = await createAPIKeyThroughWebUI();
    }

    const fallbackBranch = await this.getBranch(workspace, database, {
      allowEmpty: true,
      allowCreate: true,
      title:
        'Choose a default development branch. This will be used when you are in a git branch that does not have a corresponding Xata branch (a branch with the same name, or linked explicitely)'
    });

    let content = '';
    try {
      // TODO: check if the file already contains the key and warn if it does
      content = await readFile('.env', 'utf-8');
    } catch (err) {
      // ignore
    }
    content += '\n\n';
    content += `XATA_API_KEY=${apiKey}\n`;
    if (fallbackBranch) {
      content += `XATA_FALLBACK_BRANCH=${fallbackBranch}\n`;
    }
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

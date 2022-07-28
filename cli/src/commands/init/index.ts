import { Flags } from '@oclif/core';
import chalk from 'chalk';
import { access, readFile, writeFile } from 'fs/promises';
import path from 'path';
import which from 'which';
import { createAPIKeyThroughWebUI } from '../../auth-server.js';
import { BaseCommand } from '../../base.js';
import { isIgnored } from '../../git.js';
import { xataDatabaseSchema } from '../../schema.js';
import Browse from '../browse/index.js';
import Codegen from '../codegen/index.js';
import RandomData from '../random-data/index.js';
import EditSchema from '../schema/edit.js';
import Shell from '../shell/index.js';

export default class Init extends BaseCommand {
  static description = 'Configure your working directory to work with a Xata database';

  static examples = [
    'Initialize a new project',
    'xata init --db https://workspace-1234.xata.sh/db/database-name',
    'Initialize a new project using a schema dump',
    'xata init --db https://workspace-1234.xata.sh/db/database-name --schema schema.json',
    'Initialize a new project without flags. The workspace and database will be asked interactively',
    'xata init'
  ];

  static flags = {
    ...this.databaseURLFlag,
    ...BaseCommand.forceFlag('Overwrite existing project configuration'),
    ...BaseCommand.yesFlag,
    sdk: Flags.boolean({
      description: 'Install the TypeScript/JavaScript SDK'
    }),
    codegen: Flags.string({
      description: 'Output file to generate a TypeScript/JavaScript client with types for your database schema'
    }),
    declarations: Flags.boolean({
      description: 'Whether or not to generate type declarations for JavaScript code geneartion'
    }),
    schema: Flags.string({
      description: 'Initializes a new database or updates an existing one with the given schema'
    })
  };

  static args = [];

  async run(): Promise<void> {
    const { flags } = await this.parse(Init);

    this.log('🦋 Initializing project... We will ask you some questions.');
    this.log();

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

    await this.configureCodegen();

    await this.installSDK();

    await this.writeConfig();

    await this.writeEnvFile(workspace, database);

    if (flags.schema) {
      const branch = await this.getCurrentBranchName(databaseURL);
      await this.readAndDeploySchema(workspace, database, branch, flags.schema);
    }

    await Codegen.runIfConfigured(this.projectConfig);

    this.log();
    this.success('Project configured successfully.');
    this.info(`Next steps? Here's a list of useful commands below. Use ${chalk.bold('xata --help')} to list them all.`);
    const bullet = chalk.magenta('»');
    this.printTable(
      [],
      [
        [bullet + ' xata shell', chalk.dim(Shell.description)],
        [bullet + ' xata browse', chalk.dim(Browse.description)],
        [bullet + ' xata schema edit', chalk.dim(EditSchema.description)],
        [bullet + ' xata codegen', chalk.dim(Codegen.description)],
        [bullet + ' xata random-data', chalk.dim(RandomData.description)]
      ]
    );

    this.log();
    this.success('You are all set!');
  }

  async installSDK() {
    // If codegen is configured, the SDK is already installed
    if (this.projectConfig?.codegen) return;

    this.info(
      'We recommend generating a Xata client to help you use your database predictably and safely with autocompletion. Like this:'
    );
    this.printCode([
      "import { XataApiClient } from '@xata.io/client';",
      '',
      chalk.dim('// Initialize the client'),
      'const api = new XataApiClient();',
      '',
      chalk.dim('// Usage example'),
      "const record = await client.records.getRecord(workspace, databaseName, 'branch', 'table', recordId);"
    ]);

    const { flags } = await this.parse(Init);
    const { confirm } = await this.prompt(
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Do you want to install the TypeScript/JavaScript SDK?',
        initial: true
      },
      flags.sdk
    );
    if (confirm === undefined) return this.exit(1);
    if (!confirm) return;

    await this.installPackage('@xata.io/client');
  }

  async configureCodegen() {
    this.info(
      'Do you want to use the code generator? The code generator will allow you to use your database with type safety and autocompletion. Example:'
    );
    this.printCode([
      chalk.dim('// Import the generated code'),
      `import { XataClient } from './xata';`,
      '',
      chalk.dim('// Initialize the client'),
      'const xata = new XataClient();',
      '',
      chalk.dim('// Query a table with a simple filter'),
      'const { records } = await xata.db.TableName.filter("column", value).getPaginated();'
    ]);

    const { flags } = await this.parse(Init);
    if (!flags.codegen) {
      const { confirm } = await this.prompt({
        type: 'confirm',
        name: 'confirm',
        message: 'Do you want to use the TypeScript/JavaScript code generator?',
        initial: true
      });
      if (confirm === undefined) return this.exit(1);
      if (!confirm) return;
    }

    this.projectConfig = this.projectConfig || {};
    this.projectConfig.codegen = {};

    const { output } = await this.prompt(
      {
        type: 'text',
        name: 'output',
        message: 'Choose the output file for the code generator',
        initial: 'src/xata.ts'
      },
      flags.codegen
    );
    if (!output) return this.error('You must provide an output file');

    this.projectConfig.codegen.output = output;

    if (!output.endsWith('.ts')) {
      const { declarations } = await this.prompt(
        {
          type: 'confirm',
          name: 'declarations',
          message: 'Do you want to generate the TypeScript declarations?'
        },
        flags.declarations
      );

      if (declarations) {
        this.projectConfig.codegen.declarations = true;
      }
    }

    await this.installPackage('@xata.io/client');
  }

  printCode(lines: string[]) {
    this.log();
    for (const line of lines) {
      this.log('\t', line);
    }
    this.log();
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

  async writeConfig() {
    // Reuse location when using --force
    if (!this.projectConfigLocation) {
      this.projectConfigLocation = path.join(process.cwd(), this.searchPlaces[0]);
    }
    await this.updateConfig();
  }

  async writeEnvFile(workspace: string, database: string) {
    const envExists = await this.access('.env');
    const message = envExists ? 'update your .env file' : 'create an .env file in your project';

    this.info(`We are going to ${message}. This file will contain an API key and optionally your fallback branch.`);

    // TODO: generate a database-scoped API key
    let apiKey = (await this.getProfile())?.apiKey;

    if (!apiKey) {
      apiKey = await createAPIKeyThroughWebUI();
      // Any following API call must use this API key
      process.env.XATA_API_KEY = apiKey;
    }
    this.info(
      'The fallback branch will be used when you are in a git branch that does not have a corresponding Xata branch (a branch with the same name, or linked explicitly)'
    );

    const fallbackBranch = await this.getBranch(workspace, database, {
      allowEmpty: true,
      allowCreate: true,
      title: 'Choose a default development branch (fallback branch).'
    });

    let content = '';
    try {
      // TODO: check if the file already contains the key and warn if it does
      content = await readFile('.env', 'utf-8');
    } catch (err) {
      // ignore
    }
    if (content) content += '\n\n';
    content += '# API key used by the CLI and the SDK\n';
    content += '# Make sure your framework/tooling load this file on startup to have it available for the SDK\n';
    content += `XATA_API_KEY=${apiKey}\n`;
    if (fallbackBranch) {
      content += "# Xata branch that will be used if there's not a xata branch with the same name as your git branch\n";
      content += `XATA_FALLBACK_BRANCH=${fallbackBranch}\n`;
    }
    await writeFile('.env', content);

    await this.ignoreEnvFile();
  }

  async ignoreEnvFile() {
    const ignored = await isIgnored('.env');
    if (ignored) return;

    const exists = await this.access('.gitignore');

    const { confirm } = await this.prompt({
      type: 'confirm',
      name: 'confirm',
      message: exists
        ? 'Do you want to add .env to your .gitignore?'
        : 'Do you want to create a .gitignore file and ignore the .env file?',
      initial: true
    });
    if (confirm === undefined) return this.exit(1);
    if (!confirm) {
      this.warn('You can add .env to your .gitignore later');
      return;
    }

    let content = '';
    try {
      content = await readFile('.gitignore', 'utf-8');
    } catch (err) {
      // Ignore
    }
    if (content) content += '\n\n';
    content += '.env\n';
    await writeFile('.gitignore', content);

    this.info(`Added .env to .gitignore`);
  }

  async readAndDeploySchema(workspace: string, database: string, branch: string, file: string) {
    this.info('Reading schema file...');
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

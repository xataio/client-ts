import { Flags } from '@oclif/core';
import { buildProviderString } from '@xata.io/client';
import { ModuleType } from '@xata.io/codegen';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { access, readFile, writeFile } from 'fs/promises';
import compact from 'lodash.compact';
import path, { extname } from 'path';
import which from 'which';
import { createAPIKeyThroughWebUI } from '../../auth-server.js';
import { BaseCommand, ENV_FILES } from '../../base.js';
import { isIgnored } from '../../git.js';
import { xataDatabaseSchema } from '../../schema.js';
import { delay } from '../../utils/delay.js';
import Browse from '../browse/index.js';
import Codegen, { languages, unsupportedExtensionError } from '../codegen/index.js';
import RandomData from '../random-data/index.js';
import EditSchema from '../schema/edit.js';
import Shell from '../shell/index.js';

const moduleTypeOptions = ['cjs', 'esm'];

type PackageManager = { command: string; args: string };

const packageManagers = {
  pnpm: {
    command: 'pnpm',
    args: 'add'
  },
  npm: {
    command: 'npm',
    args: 'install --save'
  },
  yarn: {
    command: 'yarn',
    args: 'add'
  }
};

const isPackageManagerInstalled = (packageManager: PackageManager) =>
  which.sync(packageManager.command, { nothrow: true });

const installXataClientCommand = (packageManager: PackageManager) => {
  const { command, args } = packageManager;
  return `${command} ${args} @xata.io/client`;
};

export default class Init extends BaseCommand<typeof Init> {
  static description = 'Configure your working directory to work with a Xata database';

  static examples = [
    'Initialize a new project',
    'xata init',
    'Initialize a new project for a specific database',
    'xata init --db https://workspace-1234.us-east-1.xata.sh/db/database-name',
    'Initialize a new project using a schema dump',
    'xata init --db https://workspace-1234.us-east-1.xata.sh/db/database-name --schema schema.json'
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
    module: Flags.string({
      description: 'When generating JavaScript code, what kind of module to generate',
      options: moduleTypeOptions
    }),
    declarations: Flags.boolean({
      description: 'Whether or not to generate type declarations for JavaScript code geneartion'
    }),
    schema: Flags.string({
      description: 'Initializes a new database or updates an existing one with the given schema'
    }),
    packageManager: Flags.string({
      description: 'The package manager to use to install the @xata.io/client package',
      options: Object.keys(packageManagers)
    })
  };

  static args = {};

  async run(): Promise<void> {
    const { flags } = await this.parseCommand();

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

    const { workspace, region, database, databaseURL } = await this.getParsedDatabaseURL(flags.db, true);

    this.projectConfig = { databaseURL };

    await this.configureCodegen();

    await this.writeConfig();
    this.log();
    await this.writeEnvFile(workspace, region, database);
    this.log();
    if (flags.schema) {
      const branch = this.getCurrentBranchName();
      await this.readAndDeploySchema(workspace, region, database, branch, flags.schema);
    }

    await Codegen.runIfConfigured(this.projectConfig);
    await delay(1000);

    this.log();
    this.success('Project configured successfully');
    await delay(2000);
    this.log();

    this.info(`Here's a list of useful commands:`);
    const bullet = chalk.magenta('»');
    const suggestions = compact([
      this.projectConfig.codegen
        ? [bullet + ' xata pull', chalk.dim('Regenerate code and types from your Xata database')]
        : null,
      [bullet + ' xata browse', chalk.dim(Browse.description)],
      [bullet + ' xata schema edit', chalk.dim(EditSchema.description)],
      [bullet + ' xata random-data', chalk.dim(RandomData.description)],
      [bullet + ' xata shell', chalk.dim(Shell.description)]
    ]);
    this.printTable([], suggestions);

    this.info(`Use ${chalk.bold('xata --help')} to list all commands`);
  }

  async configureCodegen() {
    this.projectConfig = this.projectConfig || {};

    const { flags } = await this.parseCommand();

    let output = flags.codegen;
    let sdk = flags.sdk;
    let moduleType: ModuleType | undefined = flags.module as ModuleType;

    if (!output && !sdk) {
      const { codegen } = await this.prompt(
        {
          type: 'select',
          name: 'codegen',
          message: 'Generate code and types from your Xata database',
          choices: [
            { title: 'TypeScript', value: 'ts' },
            { title: 'TypeScript with Deno', value: 'deno' },
            { title: 'JavaScript import syntax', value: 'esm' },
            {
              title: 'JavaScript require syntax',
              value: 'cjs'
            },
            { title: 'SDK only (no code generation)', value: 'js' },
            { title: 'None', value: 'no' }
          ]
        },
        flags.module
      );

      if (['ts', 'esm', 'cjs', 'deno'].includes(codegen)) {
        const { file } = await this.prompt({
          type: 'text',
          name: 'file',
          message: 'Choose the output path for the generated code',
          initial: `src/xata.${codegen === 'ts' || codegen === 'deno' ? 'ts' : 'js'}`
        });
        if (!file) return this.error('You must provide an output file');

        const ext = extname(file);
        if (!Object.keys(languages).includes(ext)) {
          this.error(unsupportedExtensionError(ext));
        }
        if (codegen !== 'ts') {
          moduleType = codegen;
        }
        output = file;
      } else if (codegen === 'js') {
        sdk = true;
      }
    }

    if (output) {
      this.projectConfig.codegen = { output, moduleType };

      if (['.js', '.mjs', '.cjs'].includes(extname(output))) {
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
    }

    if (output || sdk) {
      await this.installPackage('@xata.io/client');
    }
  }

  async getPackageManager() {
    const packageManager = await this.guessPackageManager();
    if (!packageManager) {
      const { flags } = await this.parseCommand();
      const { packageManagerName } = await this.prompt(
        {
          type: 'select',
          name: 'packageManagerName',
          message: 'How should we install the @xata.io/client package?',
          choices: compact(
            Object.values(packageManagers).map((pm) =>
              isPackageManagerInstalled(pm) ? { title: pm.command, value: pm.command } : null
            )
          )
        },
        flags.packageManager
      );
      return packageManagers[packageManagerName as keyof typeof packageManagers];
    }
    if (packageManager && !isPackageManagerInstalled(packageManager)) {
      this.warn(
        `Looks like ${packageManager.command} is not installed or is not in the PATH. Please run ${chalk.bold(
          installXataClientCommand(packageManager)
        )}`
      );
      return null;
    }
    return packageManager;
  }

  async guessPackageManager() {
    if (await this.access('package-lock.json')) {
      return packageManagers.npm;
    } else if (await this.access('yarn.lock')) {
      return packageManagers.yarn;
    } else if (await this.access('pnpm-lock.yaml')) {
      return packageManagers.pnpm;
    }
    return null;
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
    const packageManager = await this.getPackageManager();
    if (!packageManager) return;

    const { command, args } = packageManager;
    await this.runCommand(command, [...args.split(' '), pkg]);
    this.log();
  }

  async writeConfig() {
    // Reuse location when using --force
    if (!this.projectConfigLocation) {
      this.projectConfigLocation = path.join(process.cwd(), this.searchPlaces[0]);
    }
    await this.updateConfig();
  }

  async writeEnvFile(workspace: string, region: string, database: string) {
    let envFile = ENV_FILES[ENV_FILES.length - 1];
    for (const file of ENV_FILES) {
      if (await this.access(file)) {
        envFile = file;
        break;
      }
    }
    const message = envFile ? `update your ${envFile} file` : 'create an .env file in your project';

    this.info(`We are going to ${message} to store an API key.`);

    const profile = await this.getProfile();
    // TODO: generate a database-scoped API key
    let apiKey = profile.apiKey;

    if (!apiKey) {
      apiKey = await createAPIKeyThroughWebUI();
      this.apiKeyLocation = 'new';
      // Any following API call must use this API key
      process.env.XATA_API_KEY = apiKey;

      await this.waitUntilAPIKeyIsValid(workspace, region, database);
    }

    let content = '';
    try {
      content = await readFile(envFile, 'utf-8');
      const env = dotenv.parse(content);
      if (env.XATA_API_KEY) {
        this.warn(
          `Your ${envFile} file already contains an API key. The old API key will be ignored after updating the file.`
        );
      }
    } catch (err) {
      // ignore
    }

    if (content) content += '\n\n';
    content += '# [Xata] Configuration used by the CLI and the SDK\n';
    content += '# Make sure your framework/tooling loads this file on startup to have it available for the SDK\n';
    content += `XATA_BRANCH=main\n`;
    content += `XATA_API_KEY=${apiKey}\n`;
    if (profile.host !== 'production') content += `XATA_API_PROVIDER=${buildProviderString(profile.host)}\n`;
    await writeFile(envFile, content);

    await this.ignoreEnvFile(envFile);
  }

  // New API keys need to be replicated until can be used in a particular region/database
  async waitUntilAPIKeyIsValid(workspace: string, region: string, database: string) {
    const xata = await this.getXataClient();
    const maxRetries = 10;
    let retries = 0;
    while (retries++ < maxRetries) {
      try {
        await xata.api.branches.getBranchList({ workspace, region, database });
        return;
      } catch (err) {
        if (err instanceof Error && err.message.includes('Invalid API key')) {
          if (retries % 2 === 0) {
            this.info('Waiting until the new API key is ready to be used...');
          }
          await delay(1000);
        } else {
          throw err;
        }
      }
    }
    this.error(`The new API key could not be used after ${maxRetries} seconds. Please try again.`);
  }

  async ignoreEnvFile(envFile: string) {
    const ignored = await isIgnored(envFile);
    if (ignored) return;

    const exists = await this.access('.gitignore');

    const { confirm } = await this.prompt({
      type: 'confirm',
      name: 'confirm',
      message: exists
        ? `Do you want to add ${envFile} to your .gitignore?`
        : `Do you want to create a .gitignore file and ignore the ${envFile} file?`,
      initial: true
    });
    if (confirm === undefined) return this.exit(1);
    if (!confirm) {
      this.warn(`You can add ${envFile} to your .gitignore later`);
      return;
    }

    let content = '';
    try {
      content = await readFile('.gitignore', 'utf-8');
    } catch (err) {
      // Ignore
    }
    if (content) content += '\n\n';
    content += `${envFile}\n`;
    await writeFile('.gitignore', content);

    this.info(`Added ${envFile} to .gitignore`);
  }

  async readAndDeploySchema(workspace: string, region: string, database: string, branch: string, file: string) {
    this.info('Reading schema file...');
    const schema = await this.parseSchema(file);
    await this.deploySchema(workspace, region, database, branch, schema);
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

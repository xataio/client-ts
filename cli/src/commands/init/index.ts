import { Flags } from '@oclif/core';
import { ModuleType } from '@xata.io/codegen';
import chalk from 'chalk';
import { access, readFile, writeFile } from 'fs/promises';
import path, { extname } from 'path';
import which from 'which';
import { createAPIKeyThroughWebUI } from '../../auth-server.js';
import { BaseCommand, ENV_FILES } from '../../base.js';
import { isIgnored } from '../../git.js';
import { xataDatabaseSchema } from '../../schema.js';
import Browse from '../browse/index.js';
import Codegen, { languages, unsupportedExtensionError } from '../codegen/index.js';
import RandomData from '../random-data/index.js';
import EditSchema from '../schema/edit.js';
import Shell from '../shell/index.js';
import dotenv from 'dotenv';

const moduleTypeOptions = ['cjs', 'esm'];
export default class Init extends BaseCommand {
  static description = 'Configure your working directory to work with a Xata database';

  static examples = [
    'Initialize a new project',
    'xata init --db https://workspace-1234.us-east-1.xata.sh/db/database-name',
    'Initialize a new project using a schema dump',
    'xata init --db https://workspace-1234.us-east-1.xata.sh/db/database-name --schema schema.json',
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
    module: Flags.enum({
      description: 'When generating JavaScript code, what kind of module to generate',
      options: moduleTypeOptions
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

    const { workspace, region, database, databaseURL } = await this.getParsedDatabaseURL(flags.db, true);

    this.projectConfig = { databaseURL };

    await this.configureCodegen();

    await this.writeConfig();

    await this.writeEnvFile(workspace, region, database);

    if (flags.schema) {
      const branch = await this.getCurrentBranchName(databaseURL);
      await this.readAndDeploySchema(workspace, region, database, branch, flags.schema);
    }

    await Codegen.runIfConfigured(this.projectConfig);

    this.log();
    this.success('Project configured successfully.');
    this.info(`Next steps? Here's a list of useful commands below. Use ${chalk.bold('xata --help')} to list them all.`);
    const bullet = chalk.magenta('»');
    const suggestions = [
      [bullet + ' xata shell', chalk.dim(Shell.description)],
      [bullet + ' xata browse', chalk.dim(Browse.description)],
      [bullet + ' xata schema edit', chalk.dim(EditSchema.description)],
      [bullet + ' xata random-data', chalk.dim(RandomData.description)]
    ];

    if (this.projectConfig.codegen) {
      suggestions.push([bullet + ' xata codegen', chalk.dim(Codegen.description)]);
    }

    this.printTable([], suggestions);

    this.log();
    this.success('You are all set!');
  }

  async configureCodegen() {
    this.projectConfig = this.projectConfig || {};

    const { flags } = await this.parse(Init);

    let output = flags.codegen;
    let sdk = flags.sdk;
    let moduleType: ModuleType | undefined = flags.module as ModuleType;

    if (!output && !sdk) {
      const { codegen } = await this.prompt(
        {
          type: 'select',
          name: 'codegen',
          message: 'Do you want to use code generation in your project?',
          choices: [
            { title: 'Do not use code generation', value: 'no' },
            { title: 'Generate TypeScript code', value: 'ts' },
            { title: 'Generate JavaScript code with ES modules', value: 'esm' },
            {
              title: 'Generate JavaScript code with CJS (require)',
              value: 'cjs'
            },
            { title: 'Generate TypeScript code with Deno imports', value: 'deno' },
            { title: 'Install the JavaScript SDK only, with no code generation', value: 'js' }
          ]
        },
        flags.module
      );

      if (['ts', 'esm', 'cjs', 'deno'].includes(codegen)) {
        const { file } = await this.prompt({
          type: 'text',
          name: 'file',
          message: 'Choose the output file for the code generator',
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
      this.warn('Could not detect a package manager. Please install the @xata.io/client package manually.');
      return null;
    } else if (!which.sync(packageManager.name, { nothrow: true })) {
      this.warn(
        `Looks like ${packageManager} is not installed or is not in the PATH. Please install the @xata.io/client package manually.`
      );
      return null;
    } else {
      return packageManager;
    }
  }

  async guessPackageManager() {
    if (await this.access('package-lock.json')) {
      return { name: 'npm', args: ['install', '--save'] };
    } else if (await this.access('yarn.lock')) {
      return { name: 'yarn', args: ['add'] };
    } else if (await this.access('pnpm-lock.yaml')) {
      return { name: 'pnpm', args: ['add'] };
    } else {
      return null;
    }
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

    const { name, args } = packageManager;
    await this.runCommand(name, [...args, pkg]);
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

    this.info(`We are going to ${message} to store an API key and optionally your fallback branch.`);

    // TODO: generate a database-scoped API key
    let apiKey = (await this.getProfile())?.apiKey;

    if (!apiKey) {
      apiKey = await createAPIKeyThroughWebUI();
      this.apiKeyLocation = 'new';
      // Any following API call must use this API key
      process.env.XATA_API_KEY = apiKey;

      await this.waitUntilAPIKeyIsValid(workspace, region, database);
    }
    this.info(
      'The fallback branch will be used when you are in a git branch that does not have a corresponding Xata branch (a branch with the same name, or linked explicitly)'
    );

    const fallbackBranch = await this.getBranch(workspace, region, database, {
      allowEmpty: true,
      allowCreate: true,
      title: 'Choose a default development branch (fallback branch).'
    });

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
    content += '# API key used by the CLI and the SDK\n';
    content += '# Make sure your framework/tooling loads this file on startup to have it available for the SDK\n';
    content += `XATA_API_KEY=${apiKey}\n`;
    if (fallbackBranch) {
      content += "# Xata branch that will be used if there's not a xata branch with the same name as your git branch\n";
      content += `XATA_FALLBACK_BRANCH=${fallbackBranch}\n`;
    }
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
          await new Promise((resolve) => setTimeout(resolve, 1000));
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

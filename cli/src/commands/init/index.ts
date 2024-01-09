import { Flags } from '@oclif/core';
import { buildProviderString, Schemas } from '@xata.io/client';
import { ModuleType, parseSchemaFile } from '@xata.io/codegen';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { access, readFile, writeFile } from 'fs/promises';
import compact from 'lodash.compact';
import path, { extname } from 'path';
import which from 'which';
import { createAPIKeyThroughWebUI } from '../../auth-server.js';
import { BaseCommand, ENV_FILES } from '../../base.js';
import { isIgnored } from '../../git.js';
import { getDbTableExpression } from '../../utils/codeSnippet.js';
import { delay } from '../../utils/delay.js';
import { enumFlag } from '../../utils/oclif.js';
import Browse from '../browse/index.js';
import Codegen, { languages, unsupportedExtensionError } from '../codegen/index.js';
import RandomData from '../random-data/index.js';
import EditSchema from '../schema/edit.js';
import Shell from '../shell/index.js';
import Pull from '../pull/index.js';

const moduleTypeOptions = ['cjs', 'esm'];

type PackageManager = { command: string; args: string };

type PackageManageKey = keyof typeof packageManagers;

const packageManagers = {
  bun: {
    command: 'bun',
    args: 'install'
  },
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

const DEFAULT_BRANCH = 'main';

const isPackageManagerInstalled = (packageManager: PackageManager) =>
  which.sync(packageManager.command, { nothrow: true });

const installXataClientCommand = (packageManager: PackageManager) => {
  const { command, args } = packageManager;
  return `${command} ${args} @xata.io/client`;
};

const readEnvFile = async (envFile: string) => {
  let content = '';
  try {
    content = await readFile(envFile, 'utf-8');
    const env = dotenv.parse(content);
    if (env.XATA_API_KEY) {
      return { content, containsXataApiKey: Boolean(env.XATA_API_KEY) };
    }
  } catch (err) {
    // ignore
  }
  return { content, containsXataApiKey: false };
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
      description: 'Whether or not to generate type declarations for JavaScript code generation'
    }),
    schema: Flags.string({
      description: 'Initializes a new database or updates an existing one with the given schema'
    }),
    'package-manager': enumFlag<PackageManageKey>({
      description: 'The package manager to use to install the @xata.io/client package',
      options: Object.keys(packageManagers)
    }),
    'no-delay': Flags.boolean({
      hidden: true
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
        // Clean up the project configuration so the user is asked for workspace and database again
        this.projectConfig = undefined;
      }
    }

    let schema: Schemas.Schema | undefined = undefined;
    if (flags.schema) {
      schema = await this.readSchema(flags.schema);
    }

    const { workspace, region, database, databaseURL } = await this.getParsedDatabaseURL(flags.db, true);

    const detectedBranch = this.getCurrentBranchName();
    const branch =
      detectedBranch === DEFAULT_BRANCH
        ? await this.getBranch(workspace, region, database, {
            allowCreate: false,
            allowEmpty: false,
            defaultBranch: DEFAULT_BRANCH
          })
        : detectedBranch;

    this.projectConfig = { databaseURL };
    const ignoreEnvFile = await this.promptIgnoreEnvFile();

    const { shouldInstallPackage } = await this.configureCodegen();
    const canInstallPackage = await this.access('package.json');
    const packageManager = shouldInstallPackage && canInstallPackage ? await this.getPackageManager() : null;

    this.log('\nSetting up Xata...\n');
    await this.delay(1000);
    await this.writeConfig();
    this.log();

    await this.writeEnvFile(workspace, region, database, branch);

    if (ignoreEnvFile) {
      await this.ignoreEnvFile();
    }

    this.log();
    if (packageManager) {
      await this.installPackage(packageManager, '@xata.io/client');
    }

    if (schema) {
      await this.deploySchema(workspace, region, database, branch, schema);
    }

    // Run pull to retrieve remote migrations, remove any local migrations, and generate code
    await Pull.run([branch, '-f', '--skip-code-generation']);
    await Codegen.runIfConfigured(this.projectConfig, [`--branch=${branch}`]);

    await this.delay(1000);

    this.log();
    this.success('Project setup with Xata 🦋');
    await this.delay(2000);
    this.log();

    if (this.projectConfig?.codegen?.output) {
      const { schema: currentSchema } = await (
        await this.getXataClient()
      ).api.branch.getBranchDetails({ pathParams: { workspace, region, dbBranchName: `${database}:${branch}` } });

      const hasTables = currentSchema?.tables && currentSchema?.tables.length > 0;
      const hasColumns = currentSchema?.tables.some((t) => t.columns.length > 0);
      const isSchemaSetup = hasTables && hasColumns;
      if (shouldInstallPackage && !canInstallPackage) {
        this.warn(
          `No package.json found. Please run one of: pnpm init, yarn init, npm init, bun init. Then rerun ${chalk.bold(
            'xata init --force'
          )}`
        );
      } else if (!isSchemaSetup) {
        this.info(
          `Setup ${
            hasTables ? '' : 'tables and '
          }columns at https://app.xata.io/workspaces/${workspace}/dbs/${database}:${region}`
        );
        this.log();
        this.info(`Use ${chalk.bold(`xata pull ${branch}`)} to regenerate code and types from your Xata database`);
      } else {
        this.log(`To make your first query:`);
        this.log(``);
        this.log(`import { getXataClient } from '${this.projectConfig?.codegen?.output}'`);
        this.log(``);
        this.log(`// server side query`);
        this.log(`await getXataClient().db${getDbTableExpression(currentSchema?.tables[0].name)}.getPaginated()`);
      }
    } else {
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
  }
  async delay(milliseconds: number) {
    const { flags } = await this.parseCommand();
    if (flags['no-delay']) {
      return;
    }
    return await delay(milliseconds);
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
    return { shouldInstallPackage: moduleType !== 'deno' && (output || sdk) };
  }

  async getPackageManager() {
    const packageManagerFlag = (await this.parseCommand()).flags['package-manager'];
    const packageManager = packageManagerFlag ? packageManagers[packageManagerFlag] : await this.guessPackageManager();
    if (!packageManager) {
      const { packageManagerName } = await this.prompt({
        type: 'select',
        name: 'packageManagerName',
        message: 'How should we install the @xata.io/client package?',
        choices: compact(
          Object.values(packageManagers).map((pm) =>
            isPackageManagerInstalled(pm) ? { title: pm.command, value: pm.command } : null
          )
        )
      });
      return packageManagers[packageManagerName as PackageManageKey];
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
    } else if (await this.access('bun.lockb')) {
      return packageManagers.bun;
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

  async installPackage(packageManager: PackageManager, pkg: string) {
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
    this.log(`Created Xata config: ${path.basename(this.projectConfigLocation)}`);
    await this.delay(1000);
  }

  async findEnvFile() {
    let envFile = ENV_FILES[ENV_FILES.length - 1];
    for (const file of ENV_FILES) {
      if (await this.access(file)) {
        envFile = file;
        break;
      }
    }
    return envFile;
  }

  async writeEnvFile(workspace: string, region: string, database: string, branch: string) {
    const envFile = await this.findEnvFile();
    const doesEnvFileExist = await this.access(envFile);

    const profile = await this.getProfile();
    // TODO: generate a database-scoped API key
    let apiKey = profile.apiKey;

    if (!apiKey) {
      apiKey = await createAPIKeyThroughWebUI(profile.web);
      this.apiKeyLocation = 'new';
      // Any following API call must use this API key
      process.env.XATA_API_KEY = apiKey;

      await this.waitUntilAPIKeyIsValid(workspace, region, database);
    }

    // eslint-disable-next-line prefer-const
    let { content, containsXataApiKey } = await readEnvFile(envFile);

    if (containsXataApiKey) {
      this.warn(`Your ${envFile} file already contains XATA_API_KEY key. skipping...`);
    } else {
      const setBranch = `XATA_BRANCH=${branch}`;
      if (content) content += '\n\n';
      content += '# [Xata] Configuration used by the CLI and the SDK\n';
      content += '# Make sure your framework/tooling loads this file on startup to have it available for the SDK\n';
      content += `${setBranch}\n`;
      content += `XATA_API_KEY=${apiKey}\n`;
      if (profile.host !== 'production') content += `XATA_API_PROVIDER=${buildProviderString(profile.host)}\n`;

      this.log(`${doesEnvFileExist ? 'Updating' : 'Creating'} ${envFile} file`);
      await writeFile(envFile, content);
      await this.delay(500);
      this.log(`  set XATA_API_KEY=xau_*********************************`);
      await this.delay(500);
      this.log(`  set ${setBranch}\n`);
      await this.delay(500);
    }
  }

  // New API keys need to be replicated until can be used in a particular region/database
  async waitUntilAPIKeyIsValid(workspace: string, region: string, database: string) {
    const xata = await this.getXataClient();
    const maxRetries = 10;
    let retries = 0;
    while (retries++ < maxRetries) {
      try {
        await xata.api.branch.getBranchList({ pathParams: { workspace, region, dbName: database } });
        return;
      } catch (err) {
        if (err instanceof Error && err.message.includes('Invalid API key')) {
          if (retries % 2 === 0) {
            this.info('Waiting until the new API key is ready to be used...');
          }
          await this.delay(1000);
        } else {
          throw err;
        }
      }
    }
    this.error(`The new API key could not be used after ${maxRetries} seconds. Please try again.`);
  }

  async ignoreEnvFile() {
    const envFile = await this.findEnvFile();
    let content = '';
    try {
      content = await readFile('.gitignore', 'utf-8');
    } catch (err) {
      // Ignore
    }
    if (content) content += '\n\n';
    content += `${envFile}\n`;
    await writeFile('.gitignore', content);

    this.log(`Added ${envFile} file to .gitignore`);
  }

  async promptIgnoreEnvFile() {
    const envFile = await this.findEnvFile();
    const ignored = await isIgnored(envFile);
    if (ignored) return;

    const exists = await this.access('.gitignore');

    const { gitIgnore } = await this.prompt({
      type: 'confirm',
      name: 'gitIgnore',
      message: exists ? `Add ${envFile} to .gitignore?` : `Create .gitignore and ignore ${envFile}?`,
      initial: true
    });
    if (!gitIgnore) {
      this.warn(`You can add ${envFile} to your .gitignore later`);
    }
    return Boolean(gitIgnore);
  }

  async readSchema(file: string) {
    this.info('Reading schema file...');
    return await this.parseSchema(file);
  }

  async parseSchema(file: string) {
    const json = await readFile(file, 'utf-8');
    const schema = parseSchemaFile(json);
    if (!schema.success) {
      this.warn(`The schema file is malformed`);
      this.printZodError(schema.error);
      return this.error(`Could not parse the schema file at ${file}`);
    }
    return schema.data;
  }
}

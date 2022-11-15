import { Flags } from '@oclif/core';
import { generate } from '@xata.io/codegen';
import chalk from 'chalk';
import { mkdir, writeFile } from 'fs/promises';
import path, { dirname, extname, relative } from 'path';
import { BaseCommand, ProjectConfig } from '../../base.js';

export const languages: Record<string, 'javascript' | 'typescript'> = {
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript'
};

export const unsupportedExtensionError = (ext: string) => {
  return `Cannot generate code for a file with extension ${ext}. Please use one of the following extensions: ${Object.keys(
    languages
  ).join(', ')}`;
};

export default class Codegen extends BaseCommand {
  static description = 'Generate code from the current database schema';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    ...this.databaseURLFlag,
    branch: this.branchFlag,
    output: Flags.string({
      char: 'o',
      description: 'Output file. Overwrites your project configuration setting'
    }),
    declarations: Flags.boolean({
      description:
        'Whether or not the declarations file should be generated. Overwrites your project configuration setting'
    }),
    'inject-branch': Flags.boolean({
      description:
        'Inject the branch name into the generated code. Useful if you have a build step and the branch name is not available at runtime'
    }),
    'experimental-workers': Flags.boolean({
      description: 'Add xata workers to the generated code',
      hidden: true
    })
  };

  static args = [];

  async run(): Promise<void> {
    const { flags } = await this.parse(Codegen);
    const output = flags.output || this.projectConfig?.codegen?.output;
    const moduleType = this.projectConfig?.codegen?.moduleType;

    if (!output) {
      return this.error(
        `Please, specify an output file as a flag or in your project configuration file first with ${chalk.bold(
          'xata config set codegen.output <path>'
        )}`
      );
    }

    const ext = extname(output);
    const dir = dirname(output);
    const language = languages[ext];
    if (!language) {
      return this.error(unsupportedExtensionError(ext));
    }

    const xata = await this.getXataClient();
    const { workspace, region, database, branch, databaseURL } = await this.getParsedDatabaseURLWithBranch(
      flags.db,
      flags.branch
    );
    const branchDetails = await xata.branches.getBranchDetails({ workspace, region, database, branch });
    const { schema } = branchDetails;

    const codegenBranch = flags['inject-branch'] ? branch : undefined;
    const result = await generate({
      schema,
      databaseURL,
      language,
      moduleType,
      branch: codegenBranch,
      includeWorkers: flags['experimental-workers'] ?? false
    });

    const { typescript, javascript, types } = result;
    const code = language === 'typescript' ? typescript : javascript;

    await mkdir(dir, { recursive: true });
    await writeFile(output, code);
    if (types && (flags.declarations || this.projectConfig?.codegen?.declarations)) {
      await writeFile(path.join(dir, 'types.d.ts'), types);
    }

    this.success(`Your XataClient is generated at ./${relative(process.cwd(), output)}`);
  }

  static async runIfConfigured(projectConfig?: ProjectConfig) {
    if (projectConfig?.codegen?.output) return Codegen.run([]);
  }
}

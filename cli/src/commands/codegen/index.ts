import { Flags } from '@oclif/core';
import { generate } from '@xata.io/codegen';
import chalk from 'chalk';
import { mkdir, writeFile } from 'fs/promises';
import path, { dirname, extname, relative } from 'path';
import { BaseCommand, ProjectConfig } from '../../base.js';

const languages: Record<string, 'javascript' | 'typescript'> = {
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.ts': 'typescript'
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
    })
  };

  static args = [];

  async run(): Promise<void> {
    const { flags } = await this.parse(Codegen);
    const output = flags.output || this.projectConfig?.codegen?.output;

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
      return this.error(
        `Cannot generate code for a file with extension ${ext}. Please use one of the following extensions: ${Object.keys(
          languages
        ).join(', ')}`
      );
    }

    const xata = await this.getXataClient();
    const { workspace, database, branch, databaseURL } = await this.getParsedDatabaseURLWithBranch(
      flags.db,
      flags.branch
    );
    const branchDetails = await xata.branches.getBranchDetails(workspace, database, branch);
    const { schema } = branchDetails;

    // TODO: remove formatVersion
    const result = await generate({ schema: { formatVersion: '1.0', ...schema }, databaseURL, language });
    const code = result.transpiled;
    const declarations = result.declarations;

    await mkdir(dir, { recursive: true });
    await writeFile(output, code);
    if (declarations && (flags.declarations || this.projectConfig?.codegen?.declarations)) {
      await writeFile(path.join(dir, 'types.d.ts'), declarations);
    }

    this.success(`Your XataClient is generated at ./${relative(process.cwd(), output)}`);
  }

  static async runIfConfigured(projectConfig?: ProjectConfig) {
    if (projectConfig?.codegen?.output) return Codegen.run([]);
  }
}

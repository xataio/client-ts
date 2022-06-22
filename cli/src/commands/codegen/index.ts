import { Flags } from '@oclif/core';
import { generateFromContext, Language } from '@xata.io/codegen';
import chalk from 'chalk';
import { mkdir, writeFile } from 'fs/promises';
import fetch from 'node-fetch';
import path, { dirname, extname, relative } from 'path';
import { BaseCommand, ProjectConfig } from '../../base.js';

const languages: Record<string, 'javascript' | 'typescript'> = {
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.ts': 'typescript'
};

export default class Codegen extends BaseCommand {
  static description = 'Generate code form the current database schema';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    watch: Flags.boolean({
      char: 'w',
      description: 'Watch for changes and recompile',
      default: false
    }),
    out: Flags.string({
      char: 'o',
      description: 'Output file path'
    })
  };

  static args = [];

  async run(): Promise<void> {
    const { flags } = await this.parse(Codegen);

    const output = flags.out ?? this.projectConfig?.codegen?.output;

    if (!output) {
      return this.error(
        `Please, specify an output file in your project configuration file first with ${chalk.bold(
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

    const { databaseURL } = await this.getDatabaseURL();

    if (flags.watch) {
      this.log(`Running codegen in watch mode updating your XataClient at ./${relative(process.cwd(), output)}`);

      // TODO: Implement a web-socket based watcher (not ready in the backend yet)
      // eslint-disable-next-line no-constant-condition
      while (true) {
        await this.generate({ databaseURL, language, dir, output });
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } else {
      await this.generate({ databaseURL, language, dir, output });
      this.log(`Your XataClient is generated at ./${relative(process.cwd(), output)}`);
    }
  }

  async generate(options: { databaseURL: string; language: Language; dir: string; output: string }): Promise<void> {
    const { databaseURL, language, dir, output } = options;

    const { transpiled: code, declarations } = await generateFromContext(language, {
      fetchImpl: fetch,
      databaseURL
    });

    await mkdir(dir, { recursive: true });
    await writeFile(output, code);
    if (declarations && this.projectConfig?.codegen?.declarations) {
      await writeFile(path.join(dir, 'types.d.ts'), declarations);
    }
  }

  static async runIfConfigured(projectConfig?: ProjectConfig) {
    if (projectConfig?.codegen?.output) return Codegen.run([]);
  }
}

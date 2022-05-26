import { generateFromContext } from '@xata.io/codegen';
import { mkdir, writeFile } from 'fs/promises';
import fetch from 'node-fetch';
import path, { dirname, extname, relative } from 'path';
import { BaseCommand } from '../../base.js';

const languages: Record<string, 'javascript' | 'typescript'> = {
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.ts': 'typescript'
};

export default class Codegen extends BaseCommand {
  static description = 'Generate code form the current schema';

  static examples = [];

  static flags = {};

  static args = [{ name: 'output', description: 'The output file to generate', required: false }];

  async run(): Promise<void> {
    const { args } = await this.parse(Codegen);

    const output = args.output || this.projectConfig?.codegen?.output;

    if (!output) {
      return this.error('Please, specify an output file as an argument or configure it in your config file');
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

    const result = await generateFromContext('typescript', { fetchImpl: fetch });
    const code = result.transpiled;
    const declarations = result.declarations;

    await mkdir(dir, { recursive: true });
    await writeFile(output, code);
    if (declarations && language !== 'typescript') {
      await writeFile(path.join(dir, 'types.d.ts'), declarations);
    }

    this.log(`Your XataClient is generated at ./${relative(process.cwd(), output)}`);
  }
}

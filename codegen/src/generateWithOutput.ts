import * as fs from 'fs/promises';
import * as path from 'path';
import { dirname, relative } from 'path';
import { generate, Language } from './codegen.js';
import { parseSchemaFile } from './schema.js';
import { spinner } from './spinner.js';

export interface GenerateWithOutputOptions {
  schema: ReturnType<typeof parseSchemaFile>;
  databaseURL: string;
  outputFilePath: string;
}

export const generateWithOutput = async ({ outputFilePath, schema, databaseURL }: GenerateWithOutputOptions) => {
  if (spinner) {
    spinner.text = 'Found schema, generating...';
  }

  const dir = dirname(outputFilePath);
  await fs.mkdir(dir, { recursive: true });

  const fullOutputPath = path.resolve(process.cwd(), outputFilePath);
  const [extension] = fullOutputPath.split('.').slice(-1);

  const language = getLanguageFromExtension(extension);

  const { transpiled: code, declarations } = await generate({ schema, databaseURL, language });
  await fs.writeFile(fullOutputPath, code);
  if (language === 'javascript' && declarations) {
    await fs.writeFile(`${dirname(outputFilePath)}/types.d.ts`, declarations);
  }

  spinner?.succeed(`Your XataClient is generated at ./${relative(process.cwd(), outputFilePath)}`);
};

const getLanguageFromExtension = (extension?: string): Language => {
  switch (extension) {
    case 'js':
    case 'mjs':
      return 'javascript';
    case 'ts':
    case undefined:
      return 'typescript';
    default:
      throw new Error(`You've specified an invalid extension in your output parameter. We can generate code for files in JavaScript (ending with .js), or TypeScript (ending with .ts). Please adjust your output argument.

      More in the docs: https://github.com/xataio/client-ts#readme
      `);
  }
};

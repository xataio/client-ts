import { Ora } from 'ora';
import { relative } from 'path';
import { generate } from './codegen';

export const generateWithOutput = async ({
  out,
  xataDirectory,
  spinner
}: {
  spinner: Ora;
  xataDirectory: string;
  out: string;
}) => {
  spinner.text = 'Found schema, generating...';

  await generate({ xataDirectory, outputFilePath: out });

  spinner.succeed(`Your XataClient is generated at ./${relative(process.cwd(), out)}.`);
};

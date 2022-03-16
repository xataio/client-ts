import { Ora } from 'ora';
import { relative } from 'path';
import { generate, Language } from './codegen';
import { getExtensionFromLanguage } from './getExtensionFromLanguage';

export const generateWithOutput = async ({
  lang,
  out,
  xataDirectory,
  spinner
}: {
  spinner: Ora;
  xataDirectory: string;
  out: string;
  lang: Language;
}) => {
  spinner.text = 'Found schema, generating...';

  await generate({ xataDirectory, outputFilePath: out, language: lang });

  spinner.succeed(
    `Your XataClient is generated at ./${relative(process.cwd(), `${out}${getExtensionFromLanguage(lang)}`)}.`
  );
};

import { Ora } from 'ora';
import { relative } from 'path';
import { generate, Language } from './codegen';
import { getExtensionFromLanguage } from './getExtensionFromLanguage';

export const generateWithOutput = async ({
  lang,
  out,
  schema,
  spinner
}: {
  spinner: Ora;
  schema: string;
  out: string;
  lang: Language;
}) => {
  spinner.text = 'Found schema, generating...';

  await generate({ schemaFilePath: schema, outputFilePath: out, language: lang });

  spinner.succeed(
    `Your XataClient is generated at ./${relative(process.cwd(), `${out}${getExtensionFromLanguage(lang)}`)}.`
  );
};

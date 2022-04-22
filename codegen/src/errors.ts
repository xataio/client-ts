import { ZodError } from 'zod';

export const errors = {
  invalidCodegenOutputExtension: `You've specified an invalid extension in your output parameter. We can generate code for files in JavaScript (ending with .js), or TypeScript (ending with .ts). Please adjust your output argument.

  More in the docs: https://github.com/xataio/client-ts#readme
  `
};

export const handleParsingError = (err: unknown) => {
  console.error(`The content of the config file is not valid:`);

  if (err instanceof Error) {
    console.error(err);
    process.exit(1);
  }

  if (err instanceof ZodError) {
    for (const error of err.errors) {
      console.error(`  [${error.code}]`, error.message, 'at', `"${error.path.join('.')}"`);
    }
    process.exit(1);
  }
};

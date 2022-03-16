import { ZodError } from 'zod';

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

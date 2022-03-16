import { ZodError } from 'zod';

import { XataConfigSchema, xataConfigSchema } from './config';
import { xataDatabaseSchema, XataDatabaseSchema } from './schema';

type Options = {
  type: 'schema' | 'config';
  input: string;
};

export function parseFile({ type, input }: Options & { type: 'config' }): XataConfigSchema;
export function parseFile({ type, input }: Options & { type: 'schema' }): XataDatabaseSchema;
export function parseFile({ type, input }: Options) {
  try {
    switch (type) {
      case 'schema':
        return xataDatabaseSchema.parse(JSON.parse(input));

      case 'config':
        return xataConfigSchema.parse(JSON.parse(input));
    }
  } catch (err) {
    console.error(`The content of the ${type} file is not valid:`);

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

    throw err;
  }
}

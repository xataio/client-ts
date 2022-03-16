import { xataDatabaseSchema } from './schema';
import { handleParsingError } from './handleParsingError';

export const parseSchemaFile = (input: string) => {
  try {
    return xataDatabaseSchema.parse(JSON.parse(input));
  } catch (err) {
    handleParsingError(err);
    throw err; // ^ runs process.exit(1) if successful. If not, let's throw the error.
  }
};

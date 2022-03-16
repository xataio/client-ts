import { xataConfigSchema } from './config';
import { handleParsingError } from './handleParsingError';

export const parseConfigFile = (input: string) => {
  try {
    return xataConfigSchema.parse(JSON.parse(input));
  } catch (err) {
    handleParsingError(err);
    throw err; // ^ runs process.exit(1) if successful. If not, let's throw the error.
  }
};

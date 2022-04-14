import { xataConfigSchema } from './config.js';
import { handleParsingError } from './handleParsingError.js';

export const parseConfigFile = (input: string) => {
  try {
    return xataConfigSchema.parse(JSON.parse(input));
  } catch (err) {
    handleParsingError(err);
    throw err; // ^ runs process.exit(1) if successful. If not, let's throw the error because if we don't, then this function would return its type | undefined and we'd have to optionally chain and account for potential undefined returns wherever we use it.
  }
};

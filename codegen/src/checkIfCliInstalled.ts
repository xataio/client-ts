import lameCommandExistsAsCallback from 'command-exists';
import { access } from 'fs/promises';
import { promisify } from 'util';

import { cliPath } from './cliPath';

const commandExists = promisify(lameCommandExistsAsCallback);

export const checkIfCliInstalled = async () => {
  if (await commandExists('xata')) {
    return true;
  }

  try {
    await access(cliPath);
    return true;
  } catch {
    return false;
  }
};

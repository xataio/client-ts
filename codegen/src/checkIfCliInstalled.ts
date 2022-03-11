import lameCommandExistsAsCallback from 'command-exists';
import { promisify } from 'util';

const commandExists = promisify(lameCommandExistsAsCallback);

export const checkIfCliInstalled = () => commandExists('xata');

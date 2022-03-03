import { exec as lameCallbackBasedExec } from 'child_process';
import { promisify } from 'util';

const exec = promisify(lameCallbackBasedExec);

export const checkIfCliInstalled = async () => {
  try {
    await exec('xata -h');
  } catch {
    return false;
  }

  return true;
};

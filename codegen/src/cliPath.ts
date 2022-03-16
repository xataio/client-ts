import { tmpdir } from 'os';
import { join } from 'path';

export const cliPath = join(tmpdir(), process.platform === 'win32' ? 'xata.exe' : 'xata');

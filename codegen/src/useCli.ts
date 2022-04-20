import { spawn } from 'child_process';
import { Ora } from 'ora';
import { cliPath } from './cliPath.js';

type Options = { command: 'xata' | typeof cliPath; spinner: Ora };

export const useCli = ({ command, spinner }: Options) =>
  new Promise<void>((resolve, reject) => {
    spinner.info('Delegating to Xata CLI...');

    const cli = spawn(command, ['init'], { stdio: ['inherit', 'pipe', 'pipe'] })
      .on('close', (code) => {
        if (code !== 0) {
          return;
        }
        resolve();
      })
      .on('error', reject);

    cli.stdout.pipe(process.stdout);
    cli.stdout.on('data', async (c) => {
      const line = c.toString();
      if (!/`xata auth login`/gim.test(line)) {
        return;
      }

      spinner.warn('Not logged into Xata CLI.');
      const authProcess = spawn(command, ['auth', 'login'], { stdio: 'inherit' });
      authProcess.on('exit', (code) => {
        if (code === 0) useCli({ spinner, command });
      });
    });
  });

import { spawn } from 'child_process';
import { Ora } from 'ora';

import { cliPath } from './cliPath';

export const useCli = ({ spinner }: { spinner: Ora }) =>
  new Promise<void>((resolve, reject) => {
    spinner.info('Delegating to Xata CLI...');

    const cli = spawn(cliPath, ['init'], { stdio: ['inherit', 'pipe', 'pipe'] })
      .on('close', (code) => {
        if (code !== 0) {
          return;
        }
        resolve();
      })
      .on('error', (e: unknown) => {
        reject(e);
      });

    cli.stdout.pipe(process.stdout);
    cli.stdout.on('data', async (c) => {
      const line = c.toString();
      if (line !== 'Xata CLI is not configured, please run `xata auth login`\n') {
        return;
      }

      spinner.warn('Not logged into Xata CLI.');
      const authProcess = spawn(cliPath, ['auth', 'login'], { stdio: 'inherit' });
      authProcess.on('exit', (code) => {
        if (code === 0) useCli({ spinner });
      });
    });
  });

import { spawn } from 'child_process';

export const useCli = () =>
  new Promise<void>((resolve, reject) => {
    spawn('xata', ['init'], { stdio: 'inherit' })
      .on('close', async () => {
        resolve();
      })
      .on('error', (e: unknown) => reject(e));
  });

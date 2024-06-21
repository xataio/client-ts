import { Hook } from '@oclif/core';
import { readFile } from 'fs/promises';

export const getSdkVersion = async (): Promise<null | string> => {
  const packageJson: any = JSON.parse(await readFile(`${process.cwd()}/package.json`, 'utf-8'));
  return packageJson?.dependencies?.['@xata.io/client'] ? packageJson.dependencies['@xata.io/client'] : null;
};

const hook: Hook<'next-check'> = async function (options: Record<string, unknown>) {
  if (options.pgrollEnabled) {
    const sdkVersion = await getSdkVersion();
    if (sdkVersion && !sdkVersion.includes('next')) {
      this.warn(
        "You are working with a Postgres enabled branch. We recommend using the 'next' version of the Xata SDK. (@xata.io/client@next)"
      );
    }
  }
};

export default hook;

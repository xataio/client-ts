import { unlink, writeFile } from 'fs/promises';
import fetch from 'node-fetch';
import { tmpdir } from 'os';
import { join } from 'path';
import tar from 'tar';
import unzipper from 'unzipper';
import { Ora } from 'ora';
import { createReadStream, createWriteStream } from 'fs';

import { cliPath } from './cliPath';
import chalk from 'chalk';

type GitHubResponse = {
  assets: { browser_download_url: string }[];
};

export const getCli = async ({ spinner }: { spinner: Ora }) => {
  spinner.info(
    `
You don't have the Xata CLI installed on your system, so we're downloading it. You could make this process faster by installing the CLI locally. More info: ${chalk.blueBright(
      'https://docs.xata.io/cli/getting-started'
    )}.
`
  );
  spinner.start('Looking up latest Xata CLI...');
  const fileUrl = await fetch('https://api.github.com/repos/xataio/cli/releases/latest')
    .then((r) => r.json())
    .then((d: GitHubResponse) => d.assets.map((a) => a.browser_download_url).find((a) => a.includes(process.platform)));

  if (!fileUrl) {
    failWithIncompatibleOs({ spinner });
    return;
  }

  spinner.text = 'Downloading latest Xata CLI...';
  const bundleName = fileUrl.split('/').slice(-1)[0];
  const bundle = await fetch(fileUrl).then((f) => f.buffer());
  const bundlePath = join(tmpdir(), bundleName);
  await writeFile(bundlePath, bundle);

  try {
    await unlink(cliPath);
  } catch {
    // Intentional since it'll fail if this file doesn't exist. Let's just swallow the error.
  }

  spinner.text = 'Unpacking...';
  if (bundleName.includes('.tar.gz')) {
    await tar.extract({ cwd: tmpdir(), file: bundlePath });
  } else if (bundleName.includes('.zip')) {
    const zip = createReadStream(bundlePath).pipe(unzipper.Parse({ forceStream: true }));
    for await (const entry of zip) {
      entry.pipe(createWriteStream(join(tmpdir(), entry.path)));
    }
  } else {
    failWithIncompatibleOs({ spinner });
    return;
  }

  spinner.succeed('Xata CLI now available.');
};

const failWithIncompatibleOs = ({ spinner }: { spinner: Ora }) => {
  spinner.fail(
    `No Xata CLI found for this platform (${process.platform}). Please open an issue at https://github.com/xataio/cli and we'll add this for you immediately. We apologize for the inconvenience.`
  );
};

import { unlink, writeFile } from 'fs/promises';
import fetch from 'node-fetch';
import { tmpdir } from 'os';
import { join } from 'path';
import tar from 'tar';
import unzipper from 'unzipper';
import { Ora } from 'ora';
import { createReadStream, createWriteStream } from 'fs';

import { cliPath } from './cliPath';

type GitHubResponse = {
  assets: { browser_download_url: string }[];
};

export const getCli = async ({ spinner }: { spinner: Ora }) => {
  spinner.start('Looking up latest Xata CLI...');
  const fileUrl = await fetch('https://api.github.com/repos/xataio/cli/releases/latest')
    .then((r) => r.json())
    .then((d: GitHubResponse) => d.assets.map((a) => a.browser_download_url).find((a) => a.includes(process.platform)));

  if (!fileUrl) {
    failWithIncompatibleOs({ spinner });
    return;
  }

  const bundleName = fileUrl.split('/').slice(-1)[0];

  spinner.text = 'Downloading latest Xata CLI...';
  const bundle = await fetch(fileUrl).then((f) => f.buffer());
  const bundlePath = join(tmpdir(), bundleName);
  await writeFile(bundlePath, bundle);

  try {
    await unlink(cliPath);
  } catch {
    // Intentional
  }

  spinner.text = 'Unzipping...';
  if (bundleName.includes('.tar.gz')) {
    await tar.extract({ cwd: tmpdir(), file: bundlePath });
  } else if (bundleName.includes('.zip')) {
    const zip = createReadStream(bundlePath).pipe(unzipper.Parse({ forceStream: true }));
    for await (const entry of zip) {
      entry.pipe(createWriteStream(join(tmpdir(), entry.path)));
    }
  } else {
    failWithIncompatibleOs({ spinner });
  }

  spinner.succeed('Xata CLI now available.');
};

const failWithIncompatibleOs = ({ spinner }: { spinner: Ora }) => {
  spinner.fail(
    `No Xata CLI found for this platform (${process.platform}). Please open an issue at https://github.com/xataio/cli and we'll add this for you immediately. We apologize for the inconvenience.`
  );
};

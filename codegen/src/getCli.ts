import { unlink, writeFile } from 'fs/promises';
import fetch from 'node-fetch';
import { tmpdir } from 'os';
import { join } from 'path';
import tar from 'tar';
import unzipper from 'unzipper';
import { Ora } from 'ora';
import { createReadStream, createWriteStream } from 'fs';

import { cliPath } from './cliPath';
import { getCliPlatformFromNodePlatform } from './getCliPlatformFromNodePlatform';

type GitHubResponse = {
  assets: { browser_download_url: string }[];
};

export const getCli = async ({ spinner }: { spinner: Ora }) => {
  spinner.start('Looking up latest Xata CLI...');
  const fileUrl = await fetch('https://api.github.com/repos/xataio/cli/releases/skizzy')
    .then(async (r) => {
      if (!r.ok) {
        throw errors.noCli;
      }
      return r.json();
    })
    .then((d: GitHubResponse) =>
      d.assets.map((a) => a.browser_download_url).find((a) => a.includes(getCliPlatformFromNodePlatform()))
    );

  if (!fileUrl) {
    throw errors.noCli;
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
    spinner.fail(
      `We are not quite sure how to unpack the CLI we downloaded. Please open an issue at https://github.com/xataio/cli and we'll add this for you immediately. We apologize for the inconvenience.
`
    );
    return;
  }

  spinner.succeed('Xata CLI now available.');
};

const errors = {
  noCli: new Error(`Could not find an appropriate version of the Xata CLI. This could be because:
      
  1. No Xata CLI could be found for this platform (${process.platform}). 
  2. A release of the CLI was not correctly generated.
  3. A new release of the CLI is currently being rolled out.
  
  Please open an issue at https://github.com/xataio/cli and we'll address this as soon as we can. We apologize for the inconvenience.
  `)
};

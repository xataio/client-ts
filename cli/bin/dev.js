#!/usr/bin/env -S NODE_OPTIONS=--experimental-vm-modules node --loader ts-node/esm --inspect

import oclif from '@oclif/core';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const project = path.join(__dirname, '..', 'tsconfig.json');

async function run() {
  // In dev mode -> use ts-node and dev plugins
  process.env.NODE_ENV = 'development';

  (await import('ts-node')).register({ project });

  // In dev mode, always show stack traces
  oclif.settings.debug = true;

  // Start the CLI
  return oclif.run(void 0, import.meta.url);
}

run()
  // .then(oclif.flush)
  .catch(oclif.Errors.handle);

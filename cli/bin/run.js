#!/usr/bin/env node

import { fork } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

fork(join(__dirname, 'run-oclif.js'), {
  env: {
    NODE_OPTIONS: '--experimental-vm-modules'
  }
});

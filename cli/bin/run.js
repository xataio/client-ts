#!/usr/bin/env -S NODE_OPTIONS=--experimental-vm-modules node
import { Errors, flush, run } from '@oclif/core';

run(void 0, import.meta.url)
  .then(flush)
  .catch(Errors.handle);

import { Errors, run } from '@oclif/core';

run(void 0, import.meta.url)
  // .then(flush) // Prevent timeout in xata shell
  .catch(Errors.handle);

/**
 * Oclif mostly supports ESM, but it doesn't properly support commands
 * in "index.js" files. It always thinks they are not ESM files.
 *
 * This file monkey-patches Oclif with the code
 * from this PR https://github.com/oclif/core/pull/417 to support them.
 */
import { tsPath } from '@oclif/core';
import ModuleLoader from '@oclif/core/lib/module-loader.js';
import fs from 'fs';
import path from 'path';

ModuleLoader.default.resolvePath = (config, modulePath) => {
  let isESM;
  let filePath;

  try {
    // eslint-disable-next-line no-undef
    filePath = require.resolve(modulePath);
    isESM = ModuleLoader.default.isPathModule(filePath);
  } catch {
    filePath = tsPath(config.root, modulePath);

    let fileExists = false;
    let isDirectory = false;
    if (fs.existsSync(filePath)) {
      fileExists = true;
      try {
        if (fs.lstatSync(filePath)?.isDirectory?.()) {
          fileExists = false;
          isDirectory = true;
        }
      } catch {
        // ignore
      }
    }

    if (!fileExists) {
      // Try all supported extensions.
      let foundPath = findFile(filePath);
      if (!foundPath && isDirectory) {
        // Since filePath is a directory, try looking for index.js file.
        foundPath = findFile(path.join(filePath, 'index'));
      }

      if (foundPath) {
        filePath = foundPath;
      }
    }

    isESM = ModuleLoader.default.isPathModule(filePath);
  }

  return { isESM, filePath };
};

function findFile(filePath) {
  // eslint-disable-next-line camelcase
  for (const extension of ['.js', '.cjs']) {
    const testPath = `${filePath}${extension}`;

    if (fs.existsSync(testPath)) {
      return testPath;
    }
  }

  return null;
}

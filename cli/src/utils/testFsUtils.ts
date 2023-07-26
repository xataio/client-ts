import * as fs from 'fs';
import process from 'process';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';

export const getDirectoryAsObject = (directory: string, exclude = ['node_modules']) => {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const result: Record<string, string> = {};

  entries.forEach((entry) => {
    if (!exclude.some((e) => entry.name.includes(e))) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isFile()) {
        result[entryPath.replace(`${directory}/`, '')] = fs.readFileSync(entryPath, 'utf8');
      } else if (entry.isDirectory()) {
        Object.assign(result, getDirectoryAsObject(entryPath, exclude));
      }
    }
  });
  return result;
};

export const runInTempDir = async <R>(files: Record<string, string>, func: (dir: string) => Promise<R>) => {
  const oldCwd = process.cwd();
  const tempDir = path.join(os.tmpdir(), randomUUID());
  fs.mkdirSync(tempDir, { recursive: true });
  try {
    for (const [filename, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(tempDir, filename), content);
    }
    process.chdir(tempDir);

    const result: R = await func(tempDir);

    const outputFiles = getDirectoryAsObject(tempDir);

    return { outputFiles, ...result };
  } finally {
    process.chdir(oldCwd);
    fs.rmdirSync(tempDir, { recursive: true });
  }
};

import * as fs from 'fs';
import path from 'path';

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

import * as fs from 'fs';
import path from 'path';
import mockFs from 'mock-fs';

export const getDirectoryAsObject = (directory: string, exclude = ['node_modules']) => {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const result: Record<string, string> = {};

  entries.forEach((entry) => {
    if (!exclude.some((e) => entry.name.includes(e))) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isFile()) {
        result[entryPath] = fs.readFileSync(entryPath, 'utf8');
      } else if (entry.isDirectory()) {
        Object.assign(result, getDirectoryAsObject(entryPath, exclude));
      }
    }
  });
  return result;
};

const findDirectories = (baseDir: string, pattern: RegExp): string[] => {
  const files = fs.readdirSync(baseDir);

  const matchingDirs = files
    .map((file) => path.join(baseDir, file))
    .filter((filePath) => fs.statSync(filePath).isDirectory() && pattern.test(path.basename(filePath)));

  return matchingDirs;
};

const NODE_MODULES_PATH = '../../../node_modules/.pnpm';
const ABSOLUTE_MODULE_PATH = path.resolve(__dirname, NODE_MODULES_PATH);
const COSMICONFIG_PATH = findDirectories(ABSOLUTE_MODULE_PATH, /cosmiconfig@.*/)[0];
const OCLIF_CORE_TYPES_NODE_PATH = findDirectories(
  ABSOLUTE_MODULE_PATH,
  /@oclif\+core@.+_@types\+node@.+_typescript@.+/
)[0];

const OCLIF_CORE_TYPESCRIPT_PATH = findDirectories(ABSOLUTE_MODULE_PATH, /@oclif\+core@\d+\.\d+\.\d+_typescript@.+/)[0];

export const mockFileSystem = (files: Record<string, string>) => {
  mockFs({
    ...files,
    // Mock parts of the node_modules folder which are read as tests are run.
    // Mocking all of node_modules was really slow.
    [path.join('node_modules/.pnpm', path.basename(COSMICONFIG_PATH))]: mockFs.load(COSMICONFIG_PATH),
    [path.join('node_modules/.pnpm', path.basename(OCLIF_CORE_TYPES_NODE_PATH))]:
      mockFs.load(OCLIF_CORE_TYPES_NODE_PATH),
    [path.join('node_modules/.pnpm', path.basename(OCLIF_CORE_TYPESCRIPT_PATH))]:
      mockFs.load(OCLIF_CORE_TYPESCRIPT_PATH)
  });
};

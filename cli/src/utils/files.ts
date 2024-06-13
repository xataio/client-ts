import { readFile } from 'fs/promises';
import path from 'path';

export async function safeReadFile(path: string, encoding: BufferEncoding = 'utf8') {
  try {
    return await readFile(path, encoding);
  } catch (error) {
    return null;
  }
}

export function safeJSONParse(contents: unknown) {
  try {
    return JSON.parse(contents as string);
  } catch (error) {
    return null;
  }
}

export type PackageJson = { dependencies: Record<string, string> };

export const getSdkVersion = async (pathToPackage: string): Promise<null | string> => {
  const packageJson: PackageJson = JSON.parse(await readFile(`${pathToPackage}/package.json`, 'utf-8'));
  return packageJson?.dependencies?.['@xata.io/client'] ? packageJson.dependencies['@xata.io/client'] : null;
};

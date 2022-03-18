import { readFile as nativeReadFile } from 'fs/promises';

type Options = {
  type: 'schema' | 'config';
  fullPath: string;
};

export const readFile = async ({ fullPath, type }: Options) => {
  try {
    return await nativeReadFile(fullPath, 'utf-8');
  } catch (err) {
    console.error(`Could not read ${type} file at`, fullPath);
    process.exit(1);
  }
};

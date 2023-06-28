import { readFile } from 'fs/promises';

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

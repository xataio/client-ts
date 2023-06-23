import { readFile } from 'fs/promises';

export const fileEncodings = [
  'ascii',
  'utf8',
  'utf-8',
  'utf16le',
  'ucs2',
  'ucs-2',
  'base64',
  'base64url',
  'latin1',
  'binary',
  'hex'
] as const;

export type FileEncoding = (typeof fileEncodings)[number];

export function isFileEncoding(encoding: any): encoding is FileEncoding {
  return fileEncodings.includes(encoding);
}

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

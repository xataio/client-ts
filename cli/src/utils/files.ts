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

export type FileEncoding = typeof fileEncodings[number];

export function isFileEncoding(encoding: any): encoding is FileEncoding {
  return fileEncodings.includes(encoding);
}

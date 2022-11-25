import { access, readFile } from 'fs/promises';

export function pluralize(word: string, count: number) {
  return `${word}${count === 1 ? '' : 's'}`;
}

export function reportBugURL(title: string) {
  return `https://github.com/xataio/client-ts/issues/new?labels=bug&template=bug_report.md&title=${encodeURIComponent(
    title
  )}`;
}

export async function existsFile(path: string) {
  try {
    await access(path);
    return true;
  } catch (err) {
    return false;
  }
}

export async function readJSON(path: string) {
  try {
    const content = await readFile(path);
    return JSON.parse(content.toString());
  } catch (err) {
    return null;
  }
}

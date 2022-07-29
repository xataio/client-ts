import slugify from 'slugify';

export function pluralize(word: string, count: number) {
  return `${word}${count === 1 ? '' : 's'}`;
}

// Based on `IsValidIdentifier` from xvalidator.go
export function slug(name: string) {
  const str = slugify(name, { remove: /[^a-zA-Z0-9-_~\s]/ });
  if (str.charAt(0).match(/[a-zA-Z0-9]/)) return str;
  return `a${str}`;
}

export function reportBugURL(title: string) {
  return `https://github.com/xataio/client-ts/issues/new?labels=bug&template=bug_report.md&title=${encodeURIComponent(
    title
  )}`;
}

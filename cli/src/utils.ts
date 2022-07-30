export function pluralize(word: string, count: number) {
  return `${word}${count === 1 ? '' : 's'}`;
}

// Based on `IsValidIdentifier` from xvalidator.go
export function slugify(name: string) {
  const str = (name.toLowerCase().match(/[a-z0-9-_~]+/g) || []).join('-');
  if (str.charAt(0).match(/[a-z0-9]/)) return str;
  return `x${str}`;
}

export function reportBugURL(title: string) {
  return `https://github.com/xataio/client-ts/issues/new?labels=bug&template=bug_report.md&title=${encodeURIComponent(
    title
  )}`;
}

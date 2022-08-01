export function pluralize(word: string, count: number) {
  return `${word}${count === 1 ? '' : 's'}`;
}

// Applies to the slug too
export const MAX_WORKSPACE_NAME_LENGTH = 55;

// Based on `IsValidIdentifier` from xvalidator.go
export function slugify(name: string) {
  let str = (name.toLowerCase().match(/[a-z0-9-_~]+/g) || []).join('-');
  if (!str.charAt(0).match(/[a-z0-9]/)) str = `x${str}`;
  return str.substring(0, MAX_WORKSPACE_NAME_LENGTH);
}

export function reportBugURL(title: string) {
  return `https://github.com/xataio/client-ts/issues/new?labels=bug&template=bug_report.md&title=${encodeURIComponent(
    title
  )}`;
}

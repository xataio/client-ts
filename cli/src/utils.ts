export function pluralize(word: string, count: number) {
  return `${word}${count === 1 ? '' : 's'}`;
}

export function reportBugURL(title: string) {
  return `https://github.com/xataio/client-ts/issues/new?labels=bug&template=bug_report.md&title=${encodeURIComponent(
    title
  )}`;
}

export const isNil = (value: any) => value === null || value === undefined;

export function pluralize(word: string, count: number) {
  return `${word}${count === 1 ? '' : 's'}`;
}

export function reportBugURL(title: string) {
  return `https://github.com/xataio/client-ts/issues/new?labels=bug&template=bug_report.md&title=${encodeURIComponent(
    title
  )}`;
}

// Same as xata apis (removed a single `\` to make it js compatible)
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+\\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
export function isValidEmail(email: string) {
  return EMAIL_REGEX.test(email);
}

export const isNil = (value: any) => value === null || value === undefined;

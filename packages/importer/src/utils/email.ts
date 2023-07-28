// Same as xata apis (removed a single `\` to make it js compatible)
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+\\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
export function isValidEmail(email: string) {
  return EMAIL_REGEX.test(email);
}

import { Temporal } from '@js-temporal/polyfill';

export function isValidDate(value: any): boolean {
  try {
    Temporal.PlainDateTime.from(value);
    return true;
  } catch (e) {
    return false;
  }
}

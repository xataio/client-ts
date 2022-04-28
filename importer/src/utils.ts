import { transliterate } from 'transliteration';
import camelcase from 'camelcase';

export function splitCommas(value: unknown): string[] | undefined {
  if (!value) return;
  return String(value)
    .split(',')
    .map((s) => s.trim());
}

export function normalizeColumnName(value: string) {
  const parts = value.split('.');
  return parts.map((s) => camelcase(transliterate(s)).replace(/\W/g, '')).join('.');
}

export function parseArray(value: string) {
  try {
    const val = JSON.parse(value);
    if (!Array.isArray(val)) return null;
    return val.map((item) => JSON.stringify(item));
  } catch {
    return false;
  }
}

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
    return null;
  }
}

export function guessTypes(lines: string[][], columns: string[]): string[] {
  const types: string[] = new Array(columns.length).fill(undefined);
  for (const line of lines) {
    for (let index = 0; index < columns.length; index++) {
      if (columns[index] === 'id') {
        types[index] = 'string';
        continue;
      }

      const type = types[index];
      const value = line[index];

      // In the future this can be used to specify if the column is nullable or not
      if (!value) continue;

      const valueType = guessType(value);
      if (!type) {
        types[index] = valueType;
      } else if (type !== valueType) {
        types[index] = castType(type, valueType);
      }
    }
  }
  // replace undefined types with strings. This can happen if a column is full of empty values
  return types.map((x) => x || 'string');
}

export function guessType(value: string) {
  const num = +value;
  if (Number.isSafeInteger(num)) {
    return 'int';
  } else if (Number.isFinite(num)) {
    return 'float';
  } else if (['true', 'false'].includes(value)) {
    return 'bool';
  } else if (value.match(/\S+@\S+.\S+/)) {
    return 'email';
  } else if (parseArray(value)) {
    return 'multiple';
  } else if (value.indexOf('\n') >= 0) {
    return 'text';
  }
  return 'string';
}

export function castType(a: string, b: string) {
  if (a === b) {
    return a;
  } else if ((a === 'float' && b === 'int') || (a === 'int' && b === 'float')) {
    return 'float';
  } else if (a === 'text' || b === 'text') {
    return 'text';
  }
  return 'string';
}

export function parseRow(values: string[], types: string[]) {
  return values.map((val, i) => {
    const type = types[i];
    if (type === 'int') {
      const num = +val;
      return Number.isSafeInteger(num) && val !== '' ? num : null;
    } else if (type === 'float') {
      const num = +val;
      return Number.isFinite(num) && val !== '' ? num : null;
    } else if (type === 'bool') {
      return ['true', 'false'].includes(val) ? val === 'true' : null;
    } else if (type === 'multiple') {
      return parseArray(val);
    } else if (type === 'email') {
      return val || null;
    }
    return val;
  });
}

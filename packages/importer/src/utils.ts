import { transliterate } from 'transliteration';
import camelcase from 'camelcase';

export function normalizeColumnName(value: string) {
  const parts = value.split('.');
  return parts.map((s) => camelcase(transliterate(s)).replace(/\W/g, '')).join('.');
}

function parseJSONArray(value: string) {
  try {
    const val = JSON.parse(value);
    if (!Array.isArray(val)) return null;
    return val.map((item) => JSON.stringify(item));
  } catch {
    return null;
  }
}

function parseStringArray(value: string) {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function parseArray(value: string): string[] | null {
  return parseJSONArray(value) ?? parseStringArray(value);
}

export function guessTypes(lines: string[][], columns: string[], nullValues: string[] = []): string[] {
  const types: string[] = new Array(columns.length).fill(undefined);
  for (const line of lines) {
    for (let index = 0; index < columns.length; index++) {
      if (columns[index] === 'id') {
        types[index] = 'string';
        continue;
      }

      const type = types[index];
      const value = line[index];

      // Ignore null values
      if (nullValues.includes(value)) continue;

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
  } else if (value.match(/^\S+@\S+\.\S+$/)) {
    return 'email';
  } else if (parseJSONArray(value)) {
    return 'multiple';
  } else if (value.indexOf('\n') >= 0) {
    return 'text';
  }

  return 'string';
}

export function castType(schemaType: string, valueType: string) {
  if (schemaType === valueType) {
    return schemaType;
  } else if ((schemaType === 'float' && valueType === 'int') || (schemaType === 'int' && valueType === 'float')) {
    return 'float';
  } else if (schemaType === 'text' || valueType === 'text') {
    return 'text';
  } else if (schemaType === 'link' && valueType === 'string') {
    return 'link';
  } else if (schemaType === 'datetime' && valueType === 'string') {
    return 'datetime';
  } else if (schemaType === 'bool' && valueType === 'int') {
    return 'bool';
  } else if (schemaType === 'multiple' && valueType === 'string') {
    return 'multiple';
  } else if (schemaType === 'int' && valueType === 'string') {
    return 'int';
  } else if (schemaType === 'float' && valueType === 'string') {
    return 'float';
  }

  return 'string';
}

export function parseRow(values: string[], types: string[], nullValues: string[] = []) {
  return values.map((val, i) => {
    const type = types[i];
    const num = val.length > 0 ? +val : null;

    if (nullValues.includes(val)) {
      return null;
    } else if (type === 'int') {
      return Number.isSafeInteger(num) && val !== '' ? num : null;
    } else if (type === 'float') {
      return Number.isFinite(num) && val !== '' ? num : null;
    } else if (type === 'bool') {
      if (val === 'true' || num === 1) {
        return true;
      } else if (val === 'false' || num === 0) {
        return false;
      } else {
        return null;
      }
    } else if (type === 'multiple') {
      return parseArray(val);
    } else if (type === 'email') {
      return val || null;
    } else if (type === 'link') {
      return val ? String(val) : null;
    } else if (type === 'datetime') {
      const date = new Date(val);
      return isNaN(date.getTime()) ? null : date;
    }

    return val;
  });
}

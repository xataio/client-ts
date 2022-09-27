import { describe, expect, test } from 'vitest';
import { castType, guessType, guessTypes, normalizeColumnName, parseArray, parseRow } from './utils';

describe('normalizeColumnName', () => {
  test('transliterates, removes whitespaces and camel cases and keeps dots', () => {
    expect(normalizeColumnName(' 你好. buenos días ')).toBe('niHao.buenosDias');
  });
});

describe('parseArray', () => {
  test('build array if its valid', () => {
    const result = parseArray('foo');
    expect(result).toEqual(['foo']);
  });

  test('returns an array of strings when it can be parsed as an array', () => {
    expect(parseArray('[1,2,3]')).toEqual(['1', '2', '3']);
  });

  test('returns an array of strings even when the JSON-like string is nested when parsing it', () => {
    expect(parseArray('[{},{},{}]')).toEqual(['{}', '{}', '{}']);
  });
});

describe('guessType', () => {
  test('supports all column types', () => {
    expect(guessType('1')).toBe('int');
    expect(guessType('1.1')).toBe('float');
    expect(guessType('foo')).toBe('string');
    expect(guessType('foo\nbar')).toBe('text');
    expect(guessType('foo@example.com')).toBe('email');
    expect(guessType('not an email, even though it contains foo@bar.com')).toBe('string');
    expect(guessType('[1,2,3]')).toBe('multiple');
    expect(guessType('true')).toBe('bool');
    expect(guessType('false')).toBe('bool');
  });
});

describe('castType', () => {
  test('casts to the same type if the types are equal', () => {
    expect(castType('email', 'email')).toBe('email');
    expect(castType('multiple', 'multiple')).toBe('multiple');
  });

  test('casts to float for different numeric types', () => {
    expect(castType('int', 'float')).toBe('float');
    expect(castType('float', 'int')).toBe('float');
  });

  test('casts to text for different character types', () => {
    expect(castType('string', 'text')).toBe('text');
    expect(castType('text', 'string')).toBe('text');
  });

  test('casts to string in any other case', () => {
    expect(castType('string', 'int')).toBe('string');
    expect(castType('email', 'multiple')).toBe('string');
    // etc.
  });
});

describe('guessTypes', () => {
  test('parses correctly consisten types', () => {
    expect(
      guessTypes(
        [
          ['a', 'true', '1'],
          ['b', 'false', '2']
        ],
        ['x', 'y', 'z']
      )
    ).toEqual(['string', 'bool', 'int']);
  });

  test('casts correctly to broader types', () => {
    expect(
      guessTypes(
        [
          ['a', 'true', '1'],
          ['b\nc', 'user@example.com', '2.1']
        ],
        ['x', 'y', 'z']
      )
    ).toEqual(['text', 'string', 'float']);
  });

  test('handles empty values', () => {
    expect(
      guessTypes(
        [
          ['', '', ''],
          ['b', 'false', '2']
        ],
        ['x', 'y', 'z']
      )
    ).toEqual(['string', 'bool', 'int']);
  });

  test('defaults to string for fully empty columns', () => {
    expect(
      guessTypes(
        [
          ['', '', ''],
          ['', '', '']
        ],
        ['x', 'y', 'z']
      )
    ).toEqual(['string', 'string', 'string']);
  });

  test('treats ids always as strings', () => {
    expect(guessTypes([['1', 'a', 'b']], ['id', 'y', 'z'])).toEqual(['string', 'string', 'string']);
  });
});

describe('parseRow', () => {
  test('parses ints', () => {
    expect(parseRow(['1', '2', '3'], ['int', 'int', 'int'])).toEqual([1, 2, 3]);
    expect(parseRow(['a', 'NaN', 'Infinity', ''], ['int', 'int', 'int', 'int'])).toEqual([null, null, null, null]);
  });

  test('parses floats', () => {
    expect(parseRow(['1.1', '2.1', '3.1'], ['float', 'float', 'float'])).toEqual([1.1, 2.1, 3.1]);
    expect(parseRow(['a', 'NaN', 'Infinity', ''], ['float', 'float', 'float', 'float'])).toEqual([
      null,
      null,
      null,
      null
    ]);
  });

  test('parses booleans', () => {
    expect(parseRow(['true', 'false'], ['bool', 'bool'])).toEqual([true, false]);
    expect(parseRow(['a', ''], ['bool', 'bool'])).toEqual([null, null]);
  });

  test('parses multiples', () => {
    expect(parseRow(['[]', '[1,2,3]'], ['multiple', 'multiple'])).toEqual([[], ['1', '2', '3']]);
  });

  test('parses emails', () => {
    expect(parseRow(['', 'foo@example.com'], ['email', 'email'])).toEqual([null, 'foo@example.com']);
  });
});

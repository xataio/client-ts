import { describe, expect, test } from 'vitest';
import { splitCommas } from './csv';

describe('splitCommas', () => {
  test('returns [] for falsy values', () => {
    expect(splitCommas(null)).toEqual([]);
    expect(splitCommas('')).toEqual([]);
    expect(splitCommas(false)).toEqual([]);
    expect(splitCommas(undefined)).toEqual([]);
  });

  test('returns an array with the comma separated values', () => {
    expect(splitCommas('a,b,c')).toEqual(['a', 'b', 'c']);
  });
});

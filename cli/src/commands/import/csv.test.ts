import { describe, expect, test } from 'vitest';
import { splitCommas } from './csv';

describe('splitCommas', () => {
  test('returns undefined for falsy values', () => {
    expect(splitCommas(null)).toBeUndefined();
    expect(splitCommas('')).toBeUndefined();
    expect(splitCommas(false)).toBeUndefined();
    expect(splitCommas(undefined)).toBeUndefined();
  });

  test('returns an array with the comma separated values', () => {
    expect(splitCommas('a,b,c')).toEqual(['a', 'b', 'c']);
  });
});

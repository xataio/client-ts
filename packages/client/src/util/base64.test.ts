import { describe, test, expect } from 'vitest';
import * as b64 from './base64';

describe('base64 big fata', () => {
  function equal<A, B extends A>(a: A[] | Uint8Array, b: B[] | Uint8Array) {
    let i;
    const length = a.length;
    if (length !== b.length) return false;
    for (i = 0; i < length; ++i) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  test('convert big data to base64', () => {
    const big = new Uint8Array(64 * 1024 * 1024);
    for (let i = 0, length = big.length; i < length; ++i) {
      big[i] = i % 256;
    }
    const b64str = b64.fromByteArray(big);
    const arr = b64.toByteArray(b64str);
    expect(equal(arr, big)).toBe(true);
    expect(b64.byteLength(b64str)).toEqual(arr.length);
  });
});

describe('base64 convert', () => {
  const checks = ['a', 'aa', 'aaa', 'hi', 'hi!', 'hi!!', 'sup', 'sup?', 'sup?!'];

  function map(arr: any, callback: any) {
    const res = [];
    let kValue, mappedValue;

    for (let k = 0, len = arr.length; k < len; k++) {
      if (typeof arr === 'string' && !!arr.charAt(k)) {
        kValue = arr.charAt(k);
        mappedValue = callback(kValue, k, arr);
        res[k] = mappedValue;
      } else if (typeof arr !== 'string' && k in arr) {
        kValue = arr[k];
        mappedValue = callback(kValue, k, arr);
        res[k] = mappedValue;
      }
    }
    return res;
  }

  test('convert to base64 and back', () => {
    for (let i = 0; i < checks.length; i++) {
      const check = checks[i];

      const b64Str = b64.fromByteArray(
        map(check, (char: string) => {
          return char.charCodeAt(0);
        })
      );

      const arr = b64.toByteArray(b64Str);
      const str = map(arr, (byte: number) => {
        return String.fromCharCode(byte);
      }).join('');

      expect(check).toEqual(str);
      expect(b64.byteLength(b64Str)).toEqual(arr.length);
    }
  });

  const data = [
    [[0, 0, 0], 'AAAA'],
    [[0, 0, 1], 'AAAB'],
    [[0, 1, -1], 'AAH/'],
    [[1, 1, 1], 'AQEB'],
    [[0, -73, 23], 'ALcX']
  ];

  test('convert known data to string', () => {
    for (let i = 0; i < data.length; i++) {
      const bytes = data[i][0];
      const expected = data[i][1];
      const actual = b64.fromByteArray(bytes as number[]);
      expect(actual).toEqual(expected);
    }
  });

  test('convert known data from string', () => {
    for (let i = 0; i < data.length; i++) {
      const expected = data[i][0];
      const string = data[i][1];
      const actual = b64.toByteArray(string as string);
      expect(actual).toEqual(new Uint8Array(expected as number[]));
      const length = b64.byteLength(string as string);
      expect(length).toEqual(expected.length);
    }
  });
});

describe('base64 corrupt', () => {
  test('padding bytes found inside base64 string', () => {
    // See https://github.com/beatgammit/base64-js/issues/42
    const str = 'SQ==QU0=';
    expect(b64.toByteArray(str)).toEqual(new Uint8Array([73]));
    expect(b64.byteLength(str)).toEqual(1);
  });
});

describe('base64 url safe', () => {
  test('decode url-safe style base64 strings', () => {
    const expected = [0xff, 0xff, 0xbe, 0xff, 0xef, 0xbf, 0xfb, 0xef, 0xff];

    let str = '//++/++/++//';
    let actual = b64.toByteArray(str);
    for (let i = 0; i < actual.length; i++) {
      expect(actual[i]).toEqual(expected[i]);
    }

    expect(b64.byteLength(str)).toEqual(actual.length);

    str = '__--_--_--__';
    actual = b64.toByteArray(str);
    for (let i = 0; i < actual.length; i++) {
      expect(actual[i]).toEqual(expected[i]);
    }

    expect(b64.byteLength(str)).toEqual(actual.length);
  });
});

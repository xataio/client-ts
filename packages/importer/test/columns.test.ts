import { Schemas } from '@xata.io/client';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { CoercedValue, coerceRows, coerceValue, guessColumns, guessColumnTypes } from '../src/columns';
import { ColumnOptions } from '../src/types';
import { yepNopeToBoolean } from './utils';
import path from 'path';
import fs from 'fs/promises';

const guessNumbersTestCases = [
  { input: ['1', '2', '3', '-4'], expected: 'int' },
  { input: ['1', '2', '3', null], expected: 'int' },
  { input: ['1', '2', '3.0'], expected: 'float' },
  { input: ['1', '2', '3.1'], expected: 'float' },
  { input: ['1', '2', '3.1', '3.2'], expected: 'float' },
  { input: ['1', '2 ', ' 3.1 ', ' 3.2'], expected: 'float' },
  { input: [' 1 '], expected: 'int' },
  { input: ['1', 2], expected: 'int' },
  { input: ['1', 2, '3.1'], expected: 'float' },
  { input: ['1', 2, '3.1', '1000'], expected: 'float' },
  { input: ['1', 2, 3.2], expected: 'float' },
  { input: ['1', 2, 3.2, 'null'], expected: 'float' },
  { input: ['foo', 2, 3.2, '3.3'], expected: 'string' }
];

const guessBooleansTestCases = [
  { input: ['true', 'false'], expected: 'bool' },
  { input: [' true', 'false '], expected: 'bool' },
  { input: ['true', 'false', 'true'], expected: 'bool' },
  { input: ['true', 'false', true], expected: 'bool' },
  { input: ['true', 'false', true, null], expected: 'bool' },
  { input: ['true', 'false', true, 'false'], expected: 'bool' },
  { input: [true], expected: 'bool' },
  { input: [false], expected: 'bool' },
  { input: ['true', 'false', true, 'false', 'foo'], expected: 'string' },
  { input: ['yep', 'nope'], options: { toBoolean: yepNopeToBoolean }, expected: 'bool' },
  { input: ['true', 'false'], options: { toBoolean: yepNopeToBoolean }, expected: 'string' }
];

const guessEmailsTestCases = [
  { input: ['email@example.com'], expected: 'email' },
  { input: [' email@example.com '], expected: 'email' },
  { input: ['foo', 'email@example.com'], expected: 'string' },
  { input: [2, 'email@example.com'], expected: 'string' },
  { input: ['email+1@example.com'], expected: 'email' },
  { input: ['johnrandall@schmidt-hoover.biz'], expected: 'email' },
  { input: ['email+1@example.com', undefined], expected: 'email' }
];

const guessTextTestCases = [
  { input: ['foo', 'bar'], expected: 'string' },
  { input: ['foo', 'bar', 'baz'], expected: 'string' },
  { input: ['foo', 'bar', 'baz', 'qux'], expected: 'string' },
  { input: ['foo'.repeat(150)], expected: 'text' },
  { input: ['foo', 'foo'.repeat(150)], expected: 'text' },
  { input: ['foo', 'foo'.repeat(150), 'null'], expected: 'text' }
];

const guessDatesTestCases = [
  { input: [new Date()], expected: 'datetime' },
  { input: ['2020-01-01'], expected: 'datetime' },
  { input: ['2020-01-01', '2020-01-02'], expected: 'datetime' },
  { input: ['2020-01-01', 'foo'], expected: 'string' },
  { input: ['2020-01-01T00:00:00Z'], expected: 'datetime' },
  { input: [' 2020-01-01T00:00:00Z '], expected: 'datetime' },
  { input: ['2020-01-01T00:00:00+00:00'], expected: 'datetime' },
  { input: ['2020-01-01T00:00:00+01:00'], expected: 'datetime' },
  { input: ['2/4/1964'], expected: 'datetime' },
  // excel formats
  { input: ['02/04/1964'], expected: 'datetime' },
  { input: ['02/04/1964 05:56'], expected: 'datetime' },
  { input: ['05/02/1968 17:44:00'], expected: 'datetime' },
  { input: ['today', 'yesterday'], expected: 'datetime' }
  // todo: add invalid test cases with more variety
];

const guessMultipleTestCases = [
  { input: ['foo,bar'], expected: 'string' },
  { input: ['foo,bar', 'bar'], expected: 'string' },
  { input: ['["foo", "bar"]'], expected: 'multiple' },
  { input: [['foo', 'bar']], expected: 'multiple' }
];

const guessVectorTestCases = [
  { input: [JSON.stringify(Array.from({ length: 500 }, () => Math.random()))], expected: 'vector' },
  { input: [JSON.stringify(Array.from({ length: 10 }, () => Math.random()))], expected: 'multiple' },
  { input: [JSON.stringify(['a', ...Array.from({ length: 500 }, () => Math.random())])], expected: 'multiple' }
];

const guessNullTestCases = [
  { input: [undefined], expected: 'string' },
  { input: ['null'], expected: 'string' },
  { input: [' null'], expected: 'string' },
  { input: ['NULL'], expected: 'string' },
  { input: [null], expected: 'string' },
  { input: [''], expected: 'string' }
];

const guessDataUriTestCases = [
  { input: ['data:text/plain;base64,aGVsbG8gd29ybGQ='], expected: 'file[]' },
  { input: ['data:text/plain;base64,aGVsbG8gd29ybGQ=|data:text/plain;base64,aGVsbG8gd29ybGQ='], expected: 'file[]' }
];

const tempFile = path.join(__dirname, `test.txt`);

beforeAll(async () => {
  await fs.writeFile(tempFile, 'hello world');
});
afterAll(async () => {
  fs.unlink(tempFile);
});

describe('guessColumnTypes', () => {
  describe('schema guessing for numbers', () => {
    for (const { input, expected } of guessNumbersTestCases) {
      test(`guesses ${expected} for ${JSON.stringify(input)}`, () => {
        expect(guessColumnTypes(input)).toEqual(expected);
      });
    }
  });

  describe('schema guessing for booleans', () => {
    for (const { input, options, expected } of guessBooleansTestCases) {
      test(`guesses ${expected} for ${JSON.stringify(input)}`, () => {
        expect(guessColumnTypes(input, options)).toEqual(expected);
      });
    }
  });

  describe('schema guessing for emails', () => {
    for (const { input, expected } of guessEmailsTestCases) {
      test(`guesses ${expected} for ${JSON.stringify(input)}`, () => {
        expect(guessColumnTypes(input)).toEqual(expected);
      });
    }
  });

  describe('schema guessing for text', () => {
    for (const { input, expected } of guessTextTestCases) {
      test(`guesses ${expected} for ${JSON.stringify(input)}`, () => {
        expect(guessColumnTypes(input)).toEqual(expected);
      });
    }
  });

  describe('schema guessing for dates', () => {
    for (const { input, expected } of guessDatesTestCases) {
      test(`guesses ${expected} for ${JSON.stringify(input)}`, () => {
        expect(guessColumnTypes<string | Date>(input)).toEqual(expected);
      });
    }
  });
  describe('schema guessing for multiples', () => {
    for (const { input, expected } of guessMultipleTestCases) {
      test(`guesses ${expected} for ${JSON.stringify(input)}`, () => {
        expect(guessColumnTypes(input as any)).toEqual(expected);
      });
    }
  });
  describe('schema guessing for vectors', () => {
    for (const { input, expected } of guessVectorTestCases) {
      test(`guesses ${expected} for ${JSON.stringify(input)}`, () => {
        expect(guessColumnTypes(input as any)).toEqual(expected);
      });
    }
  });
  describe('schema guessing for nulls', () => {
    for (const { input, expected } of guessNullTestCases) {
      test(`guesses ${expected} for ${JSON.stringify(input)}`, () => {
        expect(guessColumnTypes(input)).toEqual(expected);
      });
    }
  });
  describe('schema guessing for data uris', () => {
    for (const { input, expected } of guessDataUriTestCases) {
      test(`guesses ${expected} for ${JSON.stringify(input)}`, () => {
        expect(guessColumnTypes(input)).toEqual(expected);
      });
    }
  });
});

const guessColumnsTestCases = [
  { input: [{ foo: 'bar' }], expected: [{ type: 'string', name: 'foo' }] },
  { input: [{ num: 1 }], expected: [{ type: 'int', name: 'num' }] },
  { input: [{ num: 1.1 }], expected: [{ type: 'float', name: 'num' }] },
  { input: [{ num: -1.1 }], expected: [{ type: 'float', name: 'num' }] },
  { input: [{ bool: true }], expected: [{ type: 'bool', name: 'bool' }] },
  { input: [{ email: 'email@example.com' }], expected: [{ type: 'email', name: 'email' }] },
  { input: [{ date: '2020-01-01' }], expected: [{ type: 'datetime', name: 'date' }] },
  {
    input: [{ mixed: 'foo', num: 1 }],
    expected: [
      { type: 'string', name: 'mixed' },
      { type: 'int', name: 'num' }
    ]
  },
  {
    input: [{ mixed: 1, bool: true }],
    expected: [
      { type: 'int', name: 'mixed' },
      { type: 'bool', name: 'bool' }
    ]
  },
  { input: [{ longText: 'foo'.repeat(150) }], expected: [{ type: 'text', name: 'longText' }] },
  { input: [{ empty: '' }], expected: [{ type: 'string', name: 'empty' }] },
  { input: [{ num: '10' }], expected: [{ type: 'int', name: 'num' }] },
  { input: [{ bool: 'true' }], expected: [{ type: 'bool', name: 'bool' }] },
  { input: [{ date: new Date() }], expected: [{ type: 'datetime', name: 'date' }] },
  { input: [{ num: '1.1' }], expected: [{ type: 'float', name: 'num' }] },
  { input: [{ email: 'email+1@example.com' }], expected: [{ type: 'email', name: 'email' }] },
  {
    input: [{ int: '1', bool: 'true' }],
    expected: [
      { type: 'int', name: 'int' },
      { type: 'bool', name: 'bool' }
    ]
  },
  {
    input: [{ str: 'foo', num: '1.1' }],
    expected: [
      { type: 'string', name: 'str' },
      { type: 'float', name: 'num' }
    ]
  },
  {
    input: [{ bool: 'false', email: 'test@example.com' }],
    expected: [
      { type: 'bool', name: 'bool' },
      { type: 'email', name: 'email' }
    ]
  },
  { input: [{ date: 'today' }], expected: [{ type: 'datetime', name: 'date' }] },
  { input: [{ multiple: 'foo,bar' }], expected: [{ type: 'string', name: 'multiple' }] },
  { input: [{ multiple: 'foo,bar' }, { multiple: 'something' }], expected: [{ type: 'string', name: 'multiple' }] },
  { input: [{ multiple: '["foo","bar"]' }], expected: [{ type: 'multiple', name: 'multiple' }] },
  { input: [{ nullValue: null }], expected: [{ type: 'string', name: 'nullValue' }] },
  { input: [{ undefinedValue: undefined }], expected: [{ type: 'string', name: 'undefinedValue' }] },
  { input: [{ obj: { key: 'value' } }], expected: [{ type: 'string', name: 'obj' }] },
  { input: [{ arr: [1, 2, 3] }], expected: [{ type: 'multiple', name: 'arr' }] },
  { input: [{ booleanStrings: ['true', 'false'] }], expected: [{ type: 'multiple', name: 'booleanStrings' }] },
  { input: [{ booleanMixed: ['true', false] }], expected: [{ type: 'multiple', name: 'booleanMixed' }] },
  { input: [{ mixedNumbers: ['1', 2, '3.0'] }], expected: [{ type: 'multiple', name: 'mixedNumbers' }] },
  { input: [{ dateStrings: ['2020-01-01', '2020-01-02'] }], expected: [{ type: 'multiple', name: 'dateStrings' }] },
  { input: [{ complex: { num: 1, text: 'foo', bool: true } }], expected: [{ type: 'string', name: 'complex' }] },
  {
    input: [{ multiple: 1, types: 'string', inObject: true }],
    expected: [
      { type: 'int', name: 'multiple' },
      { type: 'string', name: 'types' },
      { type: 'bool', name: 'inObject' }
    ]
  },
  {
    input: [
      { multiple: 1, types: 'string', inObject: true },
      { multiple: 3, types: 'string', inObject: false }
    ],
    expected: [
      { type: 'int', name: 'multiple' },
      { type: 'string', name: 'types' },
      { type: 'bool', name: 'inObject' }
    ]
  },
  // id columns are always strings
  { input: [{ id: '1' }], expected: [{ type: 'string', name: 'id' }] }
];

describe('guessColumns', () => {
  for (const { input, expected } of guessColumnsTestCases) {
    test(`guesses ${JSON.stringify(expected)} for ${JSON.stringify(input)}`, () => {
      expect(guessColumns(input as Record<string, unknown>[])).toEqual(expected);
    });
  }
});

const coerceTestCases: {
  input: unknown;
  type: Schemas.Column['type'];
  options?: ColumnOptions;
  extraColumn?: Partial<Schemas.Column>;
  expected: unknown;
}[] = [
  { input: '1', type: 'int', expected: { value: 1, isError: false } },
  { input: ' 1 ', type: 'int', expected: { value: 1, isError: false } },
  { input: '1.0', type: 'int', expected: { value: 1, isError: false } },
  { input: '1.123', type: 'int', expected: { value: 1, isError: false } },
  { input: '-1.123', type: 'int', expected: { value: -1, isError: false } },
  { input: '1', type: 'float', expected: { value: 1.0, isError: false } },
  { input: '1000', type: 'float', expected: { value: 1000, isError: false } },
  { input: '1.1', type: 'float', expected: { value: 1.1, isError: false } },
  { input: ' 1.1 ', type: 'float', expected: { value: 1.1, isError: false } },
  { input: 'banana', type: 'float', expected: { value: null, isError: true } },
  { input: '1.1', type: 'string', expected: { value: '1.1', isError: false } },
  { input: '1', type: 'string', expected: { value: '1', isError: false } },
  { input: 'rec_xyz', type: 'link', expected: { value: 'rec_xyz', isError: false } },
  { input: 'true', type: 'bool', expected: { value: true, isError: false } },
  { input: ' true ', type: 'bool', expected: { value: true, isError: false } },
  {
    input: 'nope',
    type: 'bool',
    expected: { value: false, isError: false },
    options: { toBoolean: yepNopeToBoolean }
  },
  { input: 'false', type: 'bool', expected: { value: false, isError: false } },
  { input: 'T', type: 'bool', expected: { value: true, isError: false } },
  { input: 'notABool', type: 'bool', expected: { value: null, isError: true } },
  { input: 'something', type: 'text', expected: { value: 'something', isError: false } },
  { input: 'something', type: 'string', expected: { value: 'something', isError: false } },
  {
    input: 'johnrandall@schmidt-hoover.biz',
    type: 'email',
    expected: { value: 'johnrandall@schmidt-hoover.biz', isError: false }
  },
  {
    input: ' johnrandall@schmidt-hoover.biz ',
    type: 'email',
    expected: { value: 'johnrandall@schmidt-hoover.biz', isError: false }
  },
  { input: 'a,b', type: 'multiple', expected: { value: ['a', 'b'], isError: false } },
  { input: ' a,b', type: 'multiple', expected: { value: [' a', 'b'], isError: false } },
  { input: '["a","b"]', type: 'multiple', expected: { value: ['a', 'b'], isError: false } },
  { input: ' ["a","b"]', type: 'multiple', expected: { value: ['a', 'b'], isError: false } },
  { input: 'a', type: 'multiple', expected: { value: ['a'], isError: false } },
  { input: '2000-01-01', type: 'datetime', expected: { value: new Date('2000-01-01'), isError: false } },
  { input: ' 2000-01-01', type: 'datetime', expected: { value: new Date('2000-01-01'), isError: false } },
  {
    input: '2020-01-01T00:00:00Z',
    type: 'datetime',
    expected: { value: new Date('2020-01-01T00:00:00Z'), isError: false }
  },
  {
    input: '2020-01-01T00:00:00+00:00',
    type: 'datetime',
    expected: { value: new Date('2020-01-01T00:00:00+00:00'), isError: false }
  },
  {
    input: '2020-01-01T00:00:00+01:00',
    type: 'datetime',
    expected: { value: new Date('2020-01-01T00:00:00+01:00'), isError: false }
  },
  {
    input: 'https://does_not_exist.com',
    type: 'file',
    expected: {
      value: {
        attributes: undefined,
        base64Content: 'aGVsbG8gd29ybGQ=',
        enablePublicUrl: undefined,
        id: undefined,
        mediaType: '',
        name: undefined,
        signedUrl: undefined,
        signedUrlTimeout: undefined,
        size: undefined,
        url: undefined,
        version: undefined
      },
      isError: false
    },
    options: {
      proxyFunction: async (url) => {
        return new Blob(['hello world']);
      }
    }
  },
  {
    input: 'https://does_not_exist.com|https://does_not_exist.com',
    type: 'file[]',
    expected: {
      value: [
        {
          attributes: undefined,
          base64Content: 'aGVsbG8gd29ybGQ=',
          enablePublicUrl: undefined,
          id: undefined,
          mediaType: '',
          name: undefined,
          signedUrl: undefined,
          signedUrlTimeout: undefined,
          size: undefined,
          url: undefined,
          version: undefined
        },
        {
          attributes: undefined,
          base64Content: 'aGVsbG8gd29ybGQ=',
          enablePublicUrl: undefined,
          id: undefined,
          mediaType: '',
          name: undefined,
          signedUrl: undefined,
          signedUrlTimeout: undefined,
          size: undefined,
          url: undefined,
          version: undefined
        }
      ],
      isError: false
    },
    options: {
      proxyFunction: async (url) => {
        return new Blob(['hello world']);
      }
    }
  },
  {
    input: tempFile,
    type: 'file',
    expected: {
      value: {
        attributes: undefined,
        base64Content: 'aGVsbG8gd29ybGQ=',
        enablePublicUrl: undefined,
        id: undefined,
        mediaType: 'application/octet-stream',
        name: 'test.txt',
        signedUrl: undefined,
        signedUrlTimeout: undefined,
        size: undefined,
        url: undefined,
        version: undefined
      },
      isError: false
    }
  },
  {
    input: `${tempFile}|${tempFile}`,
    type: 'file[]',
    expected: {
      value: [
        {
          attributes: undefined,
          base64Content: 'aGVsbG8gd29ybGQ=',
          enablePublicUrl: undefined,
          id: undefined,
          mediaType: 'application/octet-stream',
          name: 'test.txt',
          signedUrl: undefined,
          signedUrlTimeout: undefined,
          size: undefined,
          url: undefined,
          version: undefined
        },
        {
          attributes: undefined,
          base64Content: 'aGVsbG8gd29ybGQ=',
          enablePublicUrl: undefined,
          id: undefined,
          mediaType: 'application/octet-stream',
          name: 'test.txt',
          signedUrl: undefined,
          signedUrlTimeout: undefined,
          size: undefined,
          url: undefined,
          version: undefined
        }
      ],
      isError: false
    }
  },
  {
    input: `data:text/plain;base64,aGVsbG8gd29ybGQ=`,
    type: 'file',
    expected: {
      value: {
        attributes: undefined,
        base64Content: 'aGVsbG8gd29ybGQ=',
        enablePublicUrl: undefined,
        id: undefined,
        mediaType: 'text/plain',
        name: undefined,
        signedUrl: undefined,
        signedUrlTimeout: undefined,
        size: undefined,
        url: undefined,
        version: undefined
      },
      isError: false
    },
    options: {
      proxyFunction: async () => {
        return new Blob(['hello world']);
      }
    }
  },
  {
    input: `data:text/plain;base64,aGVsbG8gd29ybGQ=;${tempFile},https://does_not_exist.com`,
    type: 'file[]',
    expected: {
      value: [
        {
          attributes: undefined,
          base64Content: 'aGVsbG8gd29ybGQ=',
          enablePublicUrl: undefined,
          id: undefined,
          mediaType: 'text/plain',
          name: undefined,
          signedUrl: undefined,
          signedUrlTimeout: undefined,
          size: undefined,
          url: undefined,
          version: undefined
        },
        {
          attributes: undefined,
          base64Content: 'aGVsbG8gd29ybGQ=',
          enablePublicUrl: undefined,
          id: undefined,
          mediaType: 'application/octet-stream',
          name: 'test.txt',
          signedUrl: undefined,
          signedUrlTimeout: undefined,
          size: undefined,
          url: undefined,
          version: undefined
        },
        {
          attributes: undefined,
          base64Content: 'aGVsbG8gd29ybGQ=',
          enablePublicUrl: undefined,
          id: undefined,
          mediaType: '',
          name: undefined,
          signedUrl: undefined,
          signedUrlTimeout: undefined,
          size: undefined,
          url: undefined,
          version: undefined
        }
      ],
      isError: false
    },
    options: {
      proxyFunction: async () => {
        return new Blob(['hello world']);
      }
    }
  },
  // excel formats
  // { input: '2/4/1964', type: 'datetime', expected: {value: new Date('1964-04-02') }},
  // { input: '02/04/1964', type: 'datetime', expected: {value: new Date('1964-04-02') }},
  // { input: '02/04/1964 05:56', type: 'datetime', expected: {value: new Date('1964-04-02T05:56:00.000Z') }},
  // { input: '05/02/1968 17:44:00', type: 'datetime', expected: {value: new Date('1968-02-05T17:44:00.000Z') }},
  { input: '2000-01-01', type: 'datetime', expected: { value: new Date('2000-01-01'), isError: false } },
  { input: 'something', type: 'datetime', expected: { value: null, isError: true } },
  {
    input:
      '[-0.0048622,0.004893691,-0.01636269,-0.024474753,-0.017320013,0.012539689,-0.019108698,0.009107178,-0.010215659,-0.026981432,0.022824628,0.01031643,-0.023454446,-0.006638289,0.008036486,0.0027428602,0.025079379,-0.012092519,0.0129112825,0.013037247,-0.010517972,-0.0034828973,0.003977305,0.008603323,-0.020670649,-0.0018516668,0.012231079,-0.019159084,0.030558802,-0.03101227,0.0035868173,-0.007822348,-0.006002172,-0.01774829,0.0048433053,-0.015669888,0.0013407265,-0.015581714,0.019536976,-0.016123358,0.0073373877,0.008389184,0.011443805,-0.013906396,-0.03322923,0.011317842,0.0043016616,-0.012709741,-0.0014155174,0.028392226,0.025381692,0.00069280056,-0.016274514,0.01747117,-0.016375285,0.008496254,-0.03310327,0.03108785,0.032423064,-0.021401238,0.003278206,0.0055424045,-0.0077782604,0.006068303,0.006203714,0.016916929,0.0036214574,0.0077089807,-0.018831579,0.026099686,0.024638506,0.0054888697,-0.0016013139,-0.0047708764,0.018415898,0.003116028,-0.011418613,-0.0019603106,0.005092084,0.0022138127,0.036201976,-0.027409708,-0.008546639,0.015430558,0.018907156,0.0018815832,-0.0033285916,0.020884788,-0.01444804,-0.025054187,0.012602671,0.013830818,0.006820936,0.008559235,-0.015229016,-0.002983766,-0.008653709,0.016866544,0.0041442066,-0.04799218,-0.012665654,-0.0019776307,-0.017345207,-0.013314366,-0.009050494,0.00067193777,-0.0056463243,-0.00054164405,0.025797373,0.00489684,-0.012848301,0.018818982,-0.015493539,-0.032322295,0.0046764035,-0.008590726,0.0051739602,-0.007129547,-0.016891737,-0.02337887,0.013591487,0.036806602,0.015392768,-0.026553156,0.0076774894,0.0066193943,-0.038267784,-0.015014877,0.00030979206,-0.016627213,0.041971117,0.0024373983,0.015027474,-0.011897274,-0.03201998,0.01972592,-0.008055381,0.028266262,-0.011368227,-0.016828755,0.0046354653,0.024462158,0.018100988,-0.016350092,-0.008193941,0.005813226,0.0051550656,-0.021237485,0.01104702,-0.021073733,0.0113934195,0.020544685,-0.00007956381,0.00046960855,0.013503312,0.0072807036,-0.0010651809,0.027157782,0.010196764,-0.0034545553,0.0047771744,0.0022453035,-0.0023759909,-0.035143882,0.010549462,0.02407167,0.027082203,-0.006414703,-0.006272994,-0.029097622,-0.012552286,0.010058204,-0.03466522,0.019247258,-0.0194488,0.0057565426,-0.0035899663,0.023353675,-0.014762949,-0.013742643,-0.03164209,0.008817461,0.0068650236,0.025973722,0.008830057,0.0018595397,0.012508199,-0.0017430232,0.003407319,-0.020103812,0.018718211,0.028543383,0.031037465,0.011091107,-0.6904828,-0.005463677,0.020242373,0.024361387,0.010826583,0.00906309,0.017634923,0.029828211,0.006852427,0.02990379,-0.012306657,0.017886851,-0.011324139,-0.0070665656,0.0012533391,-0.008250625,0.0018532415,-0.02104854,-0.01893235,0.019826692,0.0011911446,0.030709958,-0.021237485,-0.011771311,0.0041631013,0.008848952,0.0068020415,-0.00913237,-0.016060377,0.024877837,-0.007929417,0.019637747,-0.009189054,0.0053818007,0.06781887,0.018415898,-0.004695298,0.018881964,0.0032845044,0.030206103,-0.011210772,-0.014070149,0.0049094367,-0.0153171895,0.0010258171,0.00875448,0.012073624,-0.0040024975,0.00034836846,0.008552938,0.022509718,-0.016085569,0.017886851,0.015669888,0.0021823216,0.009510262,0.016853947,0.010845478,-0.0064304485,0.003747421,-0.0023177327,0.01889456,-0.0069783907,0.0038229993,-0.012092519,0.023794549,-0.025091976,0.008798567,-0.004613422,-0.0099889245,0.002316158,-0.0003918653,-0.021791726,-0.012306657,0.020116407,0.033052884,0.005403844,-0.012734934,-0.01333956,0.020695841,0.010952546,0.0024122056,-0.019599957,-0.02528092,0.018957542,-0.012306657,-0.031768054,-0.011872082,-0.0019603106,0.011128896,0.02924878,-0.0021587035,-0.00990075,-0.014372462,0.027157782,-0.004355196,-0.010971441,0.012949072,0.021716148,0.0021964926,0.007967206,0.0056494735,0.0017115322,0.009844066,0.01267825,-0.010045608,0.0010187317,0.019914865,0.019146487,-0.023668585,0.010133782,0.0031679878,-0.03758758,0.021476816,0.007696384,-0.029954176,-0.0014863721,0.01687914,0.019209469,-0.01417092,0.018138777,0.0039899014,0.020003041,0.0040969704,0.005060593,0.007186231,-0.003778912,0.0047425344,-0.0031868825,-0.0057565426,0.029475514,0.00089906616,0.010631339,-0.008956022,0.006373765,-0.0035301335,0.010020415,-0.014410251,0.010070801,0.016400479,-0.012533392,-0.006272994,-0.007803453,0.006953198,0.006178521,-0.017408188,-0.021237485,-0.0082569225,-0.0029884896,-0.010114888,0.012186991,-0.0118657835,-0.03191921,0.02796395,-0.0064335978,-0.0048055165,0.0077341734,-0.0253565,-0.043507874,-0.032045174,0.0070728636,0.014851124,-0.008899338,-0.0006136796,-0.005063742,-0.0250038,-0.02444956,0.008338799,0.00095417525,-0.0236182,0.010694321,-0.0074066673,-0.0159722,-0.00069280056,-0.006184819,0.015468347,-0.014347269,-0.011733522,0.0042922143,-0.015581714,0.005120426,-0.019851884,-0.022648279,0.016803563,0.014284288,-0.007904224,-0.0019980997,0.029022044,-0.010543165,0.0032687588,0.012898686,0.004465414,-0.022698665,0.00008192563,0.0031916061,-0.009705505,0.004591378,-0.003939516,0.013629276,0.014939299,0.034438483,0.0051078293,0.025419481,-0.022119232,0.002747584,-0.017231839,-0.0011832719,-0.018138777,0.013150614,0.019688131,0.009182756,-0.008061679,-0.004194592,0.024185037,0.01288609,0.03431252,-0.0018500923,-0.010921055,-0.025684005,0.0025948528,-0.0013730048,0.007885329,-0.009453578,-0.004720491,0.018881964,0.036126398,0.0050448477,0.040132046,0.00026885385,-0.027938755,-0.03327962,0.008401781,0.011053317,0.0069280053,-0.015707677,-0.0037820612,0.008149854,-0.025129765,0.030004561,0.0038198503,-0.0075767185,0.009692909,0.028845696,-0.021401238,0.012111413,0.03302769,0.006569009,-0.011198176,-0.002174449,0.030130524,-0.00090221525,-0.00047393853,-0.015216419,0.005828972,0.0030782388,-0.03657987,-0.008376588,-0.015997395,0.027989142,0.030987078,0.015921816,0.008483658,-0.0000922586,-0.008993811,0.009081985,-0.019133892,0.008294712,-0.011758715,-0.0019681833,-0.02077142,-0.0048338585,-0.004175698,0.018378109,-0.015896624,0.013654469,-0.0055864914,-0.00113761,0.000603445,-0.0039237705,-0.0028499295,-0.018856771,-0.015997395,-0.001955587,0.017244436,-0.0037820612,-0.019914865,-0.0319444,-0.000090880865,0.0018941796,-0.0020815507,-0.025872951,0.007797155,0.023844935,-0.025394289,0.0045032036,0.0045157997,0.01646346,0.004254425,-0.008263221,-0.007457053,0.023580411,0.015140841,0.0036340537,-0.01802541,0.015947009,0.00011356418,-0.012401129,-0.0218799,-0.0007030351,-0.0005475486,-0.0040780758,0.005303073,-0.005060593,0.0055487026,0.022081442,-0.004084374,-0.0056526223,0.011708329,0.023152133,-0.004093821,-0.011563471,-0.0057502445,-0.026931046,-0.013553698,0.06741579,0.0035616246,-0.007601911,0.016904334,-0.012186991,-0.0039017266,-0.043936152,-0.025822565,-0.005633728,0.0032813551,-0.0013281301,-0.0048086657,-0.00096755894,0.02677989,0.024814855,0.00085497886,0.0042607235,-0.023958301,-0.011771311,0.0018280487,0.0027570312,0.0036277554,-0.0019618853,0.015468347,0.023051362,0.0036686938,0.005095233,0.01865523,-0.0020831253,-0.0017823868,0.013654469,-0.006820936,0.017282223,0.009894451,0.019562168,0.011191878,0.008017591,0.035345424,0.010171572,-0.007690086,0.019713324,0.010354219,-0.006814638,-0.02191769,0.012407428,0.0078412425,-0.007948312,0.016476056,0.0016989359,-0.030659573,0.023693778,-0.0047362363,-0.015266804,-0.02351743,-0.010738408,0.013112824,-0.006940602,-0.015140841,-0.008830057,-0.012583777,-0.007287002,-0.0097747855,-0.017798675,-0.0031553914,-0.026704311,-0.0253565,-0.025898144,0.008748181,-0.015468347,-0.000665246,-0.013125421,-0.04045955,-0.015191226,0.007872733,0.019285047,0.0013037246,-0.007148442,-0.0073688785,0.002177598,0.015934411,0.0007179933,-0.031062657,0.0018752851,0.0027082202,0.014221305,0.008143555,0.0032467153,0.008307308,-0.012785319,0.027006624,0.012709741,0.0021350852,0.028316647,-0.010448691,0.025104571,0.0015847812,0.011890977,-0.0056463243,-0.018667825,0.0038229993,-0.0020516342,-0.010014117,-0.008911934,0.007129547,0.0022374308,0.014536215,0.013452927,0.02122489,-0.02351743,-0.005265284,0.030785536,-0.028744925,0.020846998,-0.013200999,-0.004493756,0.018768596,0.01697991,0.03199479,-0.001993376,-0.027535671,-0.009327615,-0.02761125,0.0022484527,0.014233902,0.017760886,-0.0057187537,0.007526333,-0.02184211,-0.009252036,-0.01802541,-0.008067977,0.019511782,-0.00092819525,-0.008074275,-0.024928223,-0.011084809,-0.006676078,0.00064044684,-0.0076585948,-0.013742643,-0.022257792,-0.00590455,-0.0020626562,-0.008552938,-0.043608643,-0.049176242,-0.013578891,0.008521447,-0.00917016,0.017093278,-0.0070791617,0.00059478503,-0.01590922,-0.010694321,-0.011254859,-0.013818221,0.004141058,-0.01118558,0.02330329,0.024285808,0.031490933,0.0062981867,-0.001736725,0.013931589,-0.007488544,-0.01826474,0.00051566405,-0.018315127,-0.014070149,0.012061028,0.020506896,0.03393463,0.0032687588,0.016677598,0.002191769,-0.0001621783,-0.015921816,-0.0020469106,-0.017685309,-0.012665654,-0.016614616,0.005029102,0.0008982789,0.008956022,0.016438266,-0.0023382017,0.019499186,0.010914758,0.0173704,0.0058100773,0.030281682,-0.021816919,0.027308937,0.004455967,0.010675427,-0.012722337,0.00979368,-0.0025476166,0.010864372,0.015997395,0.014636986,0.021476816,-0.017534152,-0.015216419,-0.0026798784,0.030004561,0.00830101,0.009957433,0.0042386795,-0.011525681,0.00036096483,-0.013994571,0.003378977,-0.011683136,0.005671517,-0.003816701,-0.019952655,0.028467804,-0.014322077,-0.02563362,-0.008206537,-0.00016414649,0.044011727,0.007394071,0.006376914,0.020229775,0.0033978717,-0.009283527,0.028291455,-0.02553285,-0.004755131,0.033178847,0.0013556847,0.0006530432,-0.021716148,0.0033569336,0.004660658,-0.014762949,-0.027157782,0.01861744,0.02320252,-0.0024027582,-0.020897383,0.014498426,-0.037083723,0.018630035,0.00047826854,-0.01743338,-0.021035943,0.0057533933,-0.015342383,0.008735585,-0.026351614,0.018516669,0.02733413,-0.0040024975,-0.008836356,-0.0035490282,0.0009030025,0.00085104245,-0.017723097,0.025293518,-0.005577044,0.011380823,0.011002932,0.0017115322,-0.02733413,-0.0044717127,-0.00035269847,0.017836465,-0.022207405,0.0010848626,-0.006449343,0.0098314695,0.00095496257,0.014196113,-0.007702682,-0.004430774,-0.004323705,-0.0010730536,0.021451624,-0.009881855,-0.0049346294,-0.013553698,-0.012489304,-0.029324356,-0.035446193,0.0064367466,0.005422739,-0.028467804,-0.008250625,-0.010480182,-0.0014438593,0.024777066,0.0108769685,-0.010341623,0.008351396,0.026099686,-0.022270389,0.0010037735,0.009497666,0.014649582,-0.020859594,0.022220002,-0.0030939842,-0.015342383,0.003945814,-0.015581714,-0.0052778805,0.013075035,0.01059355,0.005296775,-0.0032042025,0.0048433053,0.027384516,0.025923336,0.0068272343,-0.011727223,-0.0008423825,0.031541318,-0.005340862,0.0023759909,-0.0039710067,-0.0056967097,0.005838419,-0.0094157895,-0.0018957541,0.00038222122,-0.038998373,-0.0041662506,0.0012139755,0.013125421,0.005161364,-0.017622326,-0.034690414,-0.012961668,-0.033556737,0.0025334456,0.005369204,-0.020141602,0.014359865,0.0055550006,0.011758715,0.0017729396,0.008420676,-0.015543925,-0.022182213,-0.007948312,-0.01917168,-0.012590075,-0.004430774,0.028417418,0.007419264,-0.0145866005,-0.014246498,-0.005901401,-0.0319444,-0.022169618,-0.013389945,0.00336953,-0.010064502,0.0159722,-0.0077719623,0.034413293,0.0018296232,0.00347345,0.004714193,-0.027837984,0.009466175,-0.001618634,0.025066784,-0.006005321,-0.021690955,-0.0051361714,0.004689,0.008426974,-0.007387773,0.008426974,-0.013276578,-0.003133348,-0.01288609,0.0027066458,-0.0038859812,0.0055077644,0.020569878,-0.014082746,-0.002805842,0.00077231514,-0.0067642527,0.00482756,-0.000002288013,0.012369638,-0.012438918,0.023907917,-0.014070149,-0.006650885,0.0052369423,-0.02087219,0.022673473,-0.021816919,0.010058204,0.024651103,0.010171572,0.0027129438,-0.0011793354,0.0012226355,-0.005340862,0.0044685635,-0.0004381176,-0.009566946,0.006783147,-0.005019655,-0.01711847,-0.037285265,0.008571832,-0.02271126,-0.020834401,0.0024531437,0.028316647,0.018554458,-0.03201998,-0.014662178,-0.019977849,0.018403301,0.0065186233,-0.011242263,0.0054857205,-0.0060934955,-0.009289825,0.01636269,-0.025684005,-0.006232056,0.0094157895,0.016828755,-0.0015721848,0.039577805,0.24023803,-0.017458573,-0.009094582,0.02090998,0.02407167,0.021287872,0.007217722,-0.0014745629,0.0026625583,0.0083136065,-0.008540341,0.0017036595,-0.008282116,0.0095165605,0.0022862419,0.0067957435,-0.024436964,-0.027485287,-0.026830275,-0.025028994,0.0059580845,-0.030054947,-0.023630796,-0.012848301,0.01583364,-0.011594961,-0.008956022,-0.0050448477,0.032271907,0.013704854,0.0045000543,-0.016992508,0.016135953,0.008408079,-0.02184211,-0.014523619,0.030054947,0.006474536,0.029777827,0.010001521,-0.015052666,-0.009453578,-0.008565534,-0.0123948315,-0.0004499267,0.010121186,0.0019524379,-0.02871973,0.019524379,0.032977305,0.006203714,0.012023238,0.022875015,0.0343881,0.0031286243,-0.005832121,0.0070665656,0.02298838,-0.013730047,-0.00068217237,-0.007967206,0.0378647,0.0005727413,0.033405583,-0.022623086,0.0056274296,-0.027384516,-0.007948312,0.008867847,-0.007532631,-0.017408188,-0.0070035835,0.00795461,-0.006814638,-0.031793248,-0.02132566,0.006137583,0.011298947,0.03393463,0.033531547,-0.011714627,0.000042365147,0.0004207976,-0.023315888,-0.037209686,-0.040409166,-0.000029227522,-0.010322728,-0.015720274,-0.022522315,-0.012042133,-0.013767836,-0.0019776307,-0.005838419,0.016942123,0.018907156,-0.0030451734,0.0029995113,-0.012048431,0.010599848,-0.006402107,0.005995874,0.008433272,-0.00051448314,0.0012186992,0.010574656,-0.0043426,0.0025964275,-0.0006290314,-0.013692258,-0.020154197,-0.011374525,0.004348898,0.0017178304,-0.007633402,0.009037898,-0.0150022805,-0.0068020415,0.0015721848,-0.003153817,-0.0017131068,-0.01316321,-0.004119014,0.0012974264,0.0010037735,-0.020443914,-0.0034325118,0.009107178,0.012779021,-0.03267499,0.0052369423,0.00079199695,0.013377349,0.0077656643,-0.0044024326,-0.0017351505,0.0159722,-0.0031821588,-0.015934411,-0.0054447823,-0.007715279,-0.0058100773,0.001979205,-0.008565534,-0.010045608,-0.00593919,0.034413293,-0.022295581,-0.018378109,0.0037033337,-0.040585514,-0.01107851,-0.0065942015,-0.010373114,0.02407167,-0.017231839,-0.021968076,-0.01590922,-0.002917635,0.0057817353,-0.01504007,0.017320013,0.027384516,-0.0063548703,-0.032876533,-0.019977849,-0.16193898,0.01834032,0.016715387,-0.010706917,0.018718211,0.015695082,0.02462591,-0.0036844392,-0.008634814,0.012029536,0.00071602507,-0.010114888,-0.021439027,-0.01826474,0.0027286895,-0.019234663,-0.003278206,0.02101075,0.035370618,0.025091976,0.037108917,-0.0036938866,0.0026531112,-0.01073211,0.008956022,0.00078727334,0.003945814,0.025973722,-0.011387122,-0.0044055814,-0.013263981,-0.030206103,0.031113042,0.008137257,0.01760973,-0.0039899014,0.009396895,-0.04091302,-0.009138669,0.025746986,0.027107395,0.016450863,0.009636225,-0.011815398,-0.018151375,0.0034482572,0.015153437,0.008830057,0.019033121,-0.0012478282,0.0076648933,0.0008423825,0.004962971,-0.0015139267,0.018881964,0.025709199,0.010713216,0.023718972,0.009755891,-0.007116951,-0.011613856,-0.010341623,0.0017524704,-0.0068965144,0.012558584,-0.0032876534,-0.002427951,0.016375285,-0.005967532,0.019700728,-0.0041064178,-0.019662939,-0.010152677,-0.024651103,0.010807688,0.0021728743,-0.0406359,0.02934955,-0.0023775655,-0.0061564776,-0.0044339234,0.016853947,-0.00044953308,0.00033636254,-0.014548811,0.004937778,-0.0019177978,0.009579542,-0.023794549,-0.025091976,0.008124661,-0.018541861,-0.014914106,-0.01697991,0.0035868173,0.007690086,0.017559344,0.021829516,-0.005274731,-0.010366815,-0.0022547508,0.009667717,-0.011336736,0.004547291,0.019070908,-0.012879792,0.022648279,0.011550874,0.016589424,-0.027661636,-0.023769356,0.008981214,0.01403236,0.024021285,0.01167054,0.021262677,-0.012659355,-0.010045608,0.0038985775,-0.008653709,0.050964925,0.002393311,-0.035546966,-0.0019004778,0.0021240634,0.008993811,-0.07250472,-0.040333588,0.0041725487,0.020166794,-0.002969595,0.032826148,-0.0026420893,0.004122163,0.010580953,0.0070098815,0.004802367,-0.026024107,-0.017723097,-0.011513085,0.04189554,-0.02209404,0.006858725,-0.00026255567,-0.033783473,0.020393528,-0.015997395,0.002087849,0.0045441417,-0.0077341734,-0.0274349,0.005328266,-0.025558041,0.036201976,0.009195353,-0.008061679,-0.021124119,-0.012823108,-0.011960257,-0.0017477468,-0.016992508,0.016098166,-0.038998373,0.029324356,0.006745358,-0.034060594,0.03632794,0.012999457,-0.009189054,-0.047311977,-0.008741883,0.00965512,0.008124661,0.03705853,0.0128671955,-0.011935064,-0.014876317,-0.03733565,-0.02438658,0.012760126,0.016652405,-0.0034640026,0.008987512,0.031415354,-0.011235965,0.010776198,0.005665219,0.0037726138,-0.03144055,0.018919753,-0.011777609,0.010908459,-0.020658052,0.016715387,0.020998154,0.011544576,-0.019675534,0.025507657,0.0051771095,0.013352156,-0.039199915,-0.00038733848,-0.012986861,-0.024638506,0.016387882,-0.007979803,-0.031692475,-0.023492236,-0.0032215226,-0.0057911826,0.028417418,0.0093024215,-0.004229232,0.0039678575,-0.015266804,-0.03257422,-0.02302617,0.0067327614,0.012029536,-0.017181452,0.0037568684,0.003001086,-0.012564883,0.0025476166,0.010650233,0.018919753,-0.02201846,-0.01826474,-0.067012705,0.024323598,-0.013175807,-0.013918992,0.01347812,-0.01743338,0.008722989,-0.021892497,0.00007587347,-0.007690086,-0.021388642,-0.005397546,-0.0014540938,0.0031868825,-0.023467043,0.0038292974,0.020607667,0.014599197,0.010083397,-0.0011998046,0.0048433053,-0.025746986,-0.019058313,0.009711804,-0.01844109,0.008408079,-0.0330025,0.0048622,-0.0054542297,-0.011859486,0.0048999893,-0.044364426,-0.0011974428,0.031163428,0.0019099251,-0.009913346,0.00354273,0.013981975,0.009894451,0.023051362,-0.03310327,-0.023454446,0.016274514,-0.0035868173,-0.00040170623,-0.00021315426,-0.0029507005,-0.011676838,0.020846998,0.010196764,-0.004059181,0.025973722,-0.021829516,-0.0068965144,-0.023907917,-0.008452167,-0.02077142,-0.006474536,-0.008861548,-0.038922794,0.02017939,0.0023854382,0.022257792,-0.010505375,0.009573244,0.0027192421,-0.021161906,-0.0043677925,-0.018100988,-0.030054947,-0.0059927246,-0.008080574,0.004512651,0.014044956,0.021816919,0.016173743,-0.008345097,0.021514606,-0.040509935,0.03529504,0.01660202,0.024021285,-0.028291455,-0.001587143,0.029500706,0.0031679878,-0.008338799,-0.013125421,-0.006751656,0.010127484,-0.026704311,-0.018806385,0.005400695,0.029601477,-0.004512651,0.00025251793,0.01816397,0.008036486,0.021728745,0.01994006,0.0038891302,0.008748181,-0.005671517,0.0006573732,-0.016350092,-0.0023019873,-0.009667717,-0.032876533,-0.004783473,0.014926703,0.0069720927,0.020229775,0.0014296884,0.013188403,-0.030936694,-0.0021209144,0.021451624,-0.010203063,-0.03156651,0.039603,-0.0063706157,-0.005501466,0.030583994,-0.026351614,0.009189054,0.0008337225,-0.0037694648,-0.006480834,0.020406125,-0.00064044684,0.016413074,-0.003674992,-0.011298947,-0.018743403,-0.007620806,0.00239646,-0.009749593,0.021363448,-0.012312955,0.06409035,-0.007217722,-0.008074275,0.016098166,0.016299708,0.018063199,0.017571941,0.022597894,-0.008408079,-0.022031058,-0.01264046,0.007324791,-0.0052495385,-0.021350853,-0.015103051,0.0036623955,-0.02104854,-0.0012423174,-0.0078097517,0.011160387,0.021350853,0.0071988273,0.013314366,0.012350744,-0.019222066,-0.01747117,0.010095993,0.0061218375,-0.016778369,-0.028417418,0.015052666,0.00604311,-0.00073924963,-0.007230318,0.0050479965,-0.00033911798,-0.005265284,-0.0067201653,0.006814638,0.009925942,0.017068086,0.0021130417,-0.014964491,-0.034060594,0.013377349,0.005936041,-0.030987078,-0.012577479,-0.0076082093]',
    type: 'vector',
    extraColumn: { vector: { dimension: 1536 } },
    expected: {
      value: [
        -0.0048622, 0.004893691, -0.01636269, -0.024474753, -0.017320013, 0.012539689, -0.019108698, 0.009107178,
        -0.010215659, -0.026981432, 0.022824628, 0.01031643, -0.023454446, -0.006638289, 0.008036486, 0.0027428602,
        0.025079379, -0.012092519, 0.0129112825, 0.013037247, -0.010517972, -0.0034828973, 0.003977305, 0.008603323,
        -0.020670649, -0.0018516668, 0.012231079, -0.019159084, 0.030558802, -0.03101227, 0.0035868173, -0.007822348,
        -0.006002172, -0.01774829, 0.0048433053, -0.015669888, 0.0013407265, -0.015581714, 0.019536976, -0.016123358,
        0.0073373877, 0.008389184, 0.011443805, -0.013906396, -0.03322923, 0.011317842, 0.0043016616, -0.012709741,
        -0.0014155174, 0.028392226, 0.025381692, 0.00069280056, -0.016274514, 0.01747117, -0.016375285, 0.008496254,
        -0.03310327, 0.03108785, 0.032423064, -0.021401238, 0.003278206, 0.0055424045, -0.0077782604, 0.006068303,
        0.006203714, 0.016916929, 0.0036214574, 0.0077089807, -0.018831579, 0.026099686, 0.024638506, 0.0054888697,
        -0.0016013139, -0.0047708764, 0.018415898, 0.003116028, -0.011418613, -0.0019603106, 0.005092084, 0.0022138127,
        0.036201976, -0.027409708, -0.008546639, 0.015430558, 0.018907156, 0.0018815832, -0.0033285916, 0.020884788,
        -0.01444804, -0.025054187, 0.012602671, 0.013830818, 0.006820936, 0.008559235, -0.015229016, -0.002983766,
        -0.008653709, 0.016866544, 0.0041442066, -0.04799218, -0.012665654, -0.0019776307, -0.017345207, -0.013314366,
        -0.009050494, 0.00067193777, -0.0056463243, -0.00054164405, 0.025797373, 0.00489684, -0.012848301, 0.018818982,
        -0.015493539, -0.032322295, 0.0046764035, -0.008590726, 0.0051739602, -0.007129547, -0.016891737, -0.02337887,
        0.013591487, 0.036806602, 0.015392768, -0.026553156, 0.0076774894, 0.0066193943, -0.038267784, -0.015014877,
        0.00030979206, -0.016627213, 0.041971117, 0.0024373983, 0.015027474, -0.011897274, -0.03201998, 0.01972592,
        -0.008055381, 0.028266262, -0.011368227, -0.016828755, 0.0046354653, 0.024462158, 0.018100988, -0.016350092,
        -0.008193941, 0.005813226, 0.0051550656, -0.021237485, 0.01104702, -0.021073733, 0.0113934195, 0.020544685,
        -0.00007956381, 0.00046960855, 0.013503312, 0.0072807036, -0.0010651809, 0.027157782, 0.010196764,
        -0.0034545553, 0.0047771744, 0.0022453035, -0.0023759909, -0.035143882, 0.010549462, 0.02407167, 0.027082203,
        -0.006414703, -0.006272994, -0.029097622, -0.012552286, 0.010058204, -0.03466522, 0.019247258, -0.0194488,
        0.0057565426, -0.0035899663, 0.023353675, -0.014762949, -0.013742643, -0.03164209, 0.008817461, 0.0068650236,
        0.025973722, 0.008830057, 0.0018595397, 0.012508199, -0.0017430232, 0.003407319, -0.020103812, 0.018718211,
        0.028543383, 0.031037465, 0.011091107, -0.6904828, -0.005463677, 0.020242373, 0.024361387, 0.010826583,
        0.00906309, 0.017634923, 0.029828211, 0.006852427, 0.02990379, -0.012306657, 0.017886851, -0.011324139,
        -0.0070665656, 0.0012533391, -0.008250625, 0.0018532415, -0.02104854, -0.01893235, 0.019826692, 0.0011911446,
        0.030709958, -0.021237485, -0.011771311, 0.0041631013, 0.008848952, 0.0068020415, -0.00913237, -0.016060377,
        0.024877837, -0.007929417, 0.019637747, -0.009189054, 0.0053818007, 0.06781887, 0.018415898, -0.004695298,
        0.018881964, 0.0032845044, 0.030206103, -0.011210772, -0.014070149, 0.0049094367, -0.0153171895, 0.0010258171,
        0.00875448, 0.012073624, -0.0040024975, 0.00034836846, 0.008552938, 0.022509718, -0.016085569, 0.017886851,
        0.015669888, 0.0021823216, 0.009510262, 0.016853947, 0.010845478, -0.0064304485, 0.003747421, -0.0023177327,
        0.01889456, -0.0069783907, 0.0038229993, -0.012092519, 0.023794549, -0.025091976, 0.008798567, -0.004613422,
        -0.0099889245, 0.002316158, -0.0003918653, -0.021791726, -0.012306657, 0.020116407, 0.033052884, 0.005403844,
        -0.012734934, -0.01333956, 0.020695841, 0.010952546, 0.0024122056, -0.019599957, -0.02528092, 0.018957542,
        -0.012306657, -0.031768054, -0.011872082, -0.0019603106, 0.011128896, 0.02924878, -0.0021587035, -0.00990075,
        -0.014372462, 0.027157782, -0.004355196, -0.010971441, 0.012949072, 0.021716148, 0.0021964926, 0.007967206,
        0.0056494735, 0.0017115322, 0.009844066, 0.01267825, -0.010045608, 0.0010187317, 0.019914865, 0.019146487,
        -0.023668585, 0.010133782, 0.0031679878, -0.03758758, 0.021476816, 0.007696384, -0.029954176, -0.0014863721,
        0.01687914, 0.019209469, -0.01417092, 0.018138777, 0.0039899014, 0.020003041, 0.0040969704, 0.005060593,
        0.007186231, -0.003778912, 0.0047425344, -0.0031868825, -0.0057565426, 0.029475514, 0.00089906616, 0.010631339,
        -0.008956022, 0.006373765, -0.0035301335, 0.010020415, -0.014410251, 0.010070801, 0.016400479, -0.012533392,
        -0.006272994, -0.007803453, 0.006953198, 0.006178521, -0.017408188, -0.021237485, -0.0082569225, -0.0029884896,
        -0.010114888, 0.012186991, -0.0118657835, -0.03191921, 0.02796395, -0.0064335978, -0.0048055165, 0.0077341734,
        -0.0253565, -0.043507874, -0.032045174, 0.0070728636, 0.014851124, -0.008899338, -0.0006136796, -0.005063742,
        -0.0250038, -0.02444956, 0.008338799, 0.00095417525, -0.0236182, 0.010694321, -0.0074066673, -0.0159722,
        -0.00069280056, -0.006184819, 0.015468347, -0.014347269, -0.011733522, 0.0042922143, -0.015581714, 0.005120426,
        -0.019851884, -0.022648279, 0.016803563, 0.014284288, -0.007904224, -0.0019980997, 0.029022044, -0.010543165,
        0.0032687588, 0.012898686, 0.004465414, -0.022698665, 0.00008192563, 0.0031916061, -0.009705505, 0.004591378,
        -0.003939516, 0.013629276, 0.014939299, 0.034438483, 0.0051078293, 0.025419481, -0.022119232, 0.002747584,
        -0.017231839, -0.0011832719, -0.018138777, 0.013150614, 0.019688131, 0.009182756, -0.008061679, -0.004194592,
        0.024185037, 0.01288609, 0.03431252, -0.0018500923, -0.010921055, -0.025684005, 0.0025948528, -0.0013730048,
        0.007885329, -0.009453578, -0.004720491, 0.018881964, 0.036126398, 0.0050448477, 0.040132046, 0.00026885385,
        -0.027938755, -0.03327962, 0.008401781, 0.011053317, 0.0069280053, -0.015707677, -0.0037820612, 0.008149854,
        -0.025129765, 0.030004561, 0.0038198503, -0.0075767185, 0.009692909, 0.028845696, -0.021401238, 0.012111413,
        0.03302769, 0.006569009, -0.011198176, -0.002174449, 0.030130524, -0.00090221525, -0.00047393853, -0.015216419,
        0.005828972, 0.0030782388, -0.03657987, -0.008376588, -0.015997395, 0.027989142, 0.030987078, 0.015921816,
        0.008483658, -0.0000922586, -0.008993811, 0.009081985, -0.019133892, 0.008294712, -0.011758715, -0.0019681833,
        -0.02077142, -0.0048338585, -0.004175698, 0.018378109, -0.015896624, 0.013654469, -0.0055864914, -0.00113761,
        0.000603445, -0.0039237705, -0.0028499295, -0.018856771, -0.015997395, -0.001955587, 0.017244436, -0.0037820612,
        -0.019914865, -0.0319444, -0.000090880865, 0.0018941796, -0.0020815507, -0.025872951, 0.007797155, 0.023844935,
        -0.025394289, 0.0045032036, 0.0045157997, 0.01646346, 0.004254425, -0.008263221, -0.007457053, 0.023580411,
        0.015140841, 0.0036340537, -0.01802541, 0.015947009, 0.00011356418, -0.012401129, -0.0218799, -0.0007030351,
        -0.0005475486, -0.0040780758, 0.005303073, -0.005060593, 0.0055487026, 0.022081442, -0.004084374, -0.0056526223,
        0.011708329, 0.023152133, -0.004093821, -0.011563471, -0.0057502445, -0.026931046, -0.013553698, 0.06741579,
        0.0035616246, -0.007601911, 0.016904334, -0.012186991, -0.0039017266, -0.043936152, -0.025822565, -0.005633728,
        0.0032813551, -0.0013281301, -0.0048086657, -0.00096755894, 0.02677989, 0.024814855, 0.00085497886,
        0.0042607235, -0.023958301, -0.011771311, 0.0018280487, 0.0027570312, 0.0036277554, -0.0019618853, 0.015468347,
        0.023051362, 0.0036686938, 0.005095233, 0.01865523, -0.0020831253, -0.0017823868, 0.013654469, -0.006820936,
        0.017282223, 0.009894451, 0.019562168, 0.011191878, 0.008017591, 0.035345424, 0.010171572, -0.007690086,
        0.019713324, 0.010354219, -0.006814638, -0.02191769, 0.012407428, 0.0078412425, -0.007948312, 0.016476056,
        0.0016989359, -0.030659573, 0.023693778, -0.0047362363, -0.015266804, -0.02351743, -0.010738408, 0.013112824,
        -0.006940602, -0.015140841, -0.008830057, -0.012583777, -0.007287002, -0.0097747855, -0.017798675,
        -0.0031553914, -0.026704311, -0.0253565, -0.025898144, 0.008748181, -0.015468347, -0.000665246, -0.013125421,
        -0.04045955, -0.015191226, 0.007872733, 0.019285047, 0.0013037246, -0.007148442, -0.0073688785, 0.002177598,
        0.015934411, 0.0007179933, -0.031062657, 0.0018752851, 0.0027082202, 0.014221305, 0.008143555, 0.0032467153,
        0.008307308, -0.012785319, 0.027006624, 0.012709741, 0.0021350852, 0.028316647, -0.010448691, 0.025104571,
        0.0015847812, 0.011890977, -0.0056463243, -0.018667825, 0.0038229993, -0.0020516342, -0.010014117, -0.008911934,
        0.007129547, 0.0022374308, 0.014536215, 0.013452927, 0.02122489, -0.02351743, -0.005265284, 0.030785536,
        -0.028744925, 0.020846998, -0.013200999, -0.004493756, 0.018768596, 0.01697991, 0.03199479, -0.001993376,
        -0.027535671, -0.009327615, -0.02761125, 0.0022484527, 0.014233902, 0.017760886, -0.0057187537, 0.007526333,
        -0.02184211, -0.009252036, -0.01802541, -0.008067977, 0.019511782, -0.00092819525, -0.008074275, -0.024928223,
        -0.011084809, -0.006676078, 0.00064044684, -0.0076585948, -0.013742643, -0.022257792, -0.00590455,
        -0.0020626562, -0.008552938, -0.043608643, -0.049176242, -0.013578891, 0.008521447, -0.00917016, 0.017093278,
        -0.0070791617, 0.00059478503, -0.01590922, -0.010694321, -0.011254859, -0.013818221, 0.004141058, -0.01118558,
        0.02330329, 0.024285808, 0.031490933, 0.0062981867, -0.001736725, 0.013931589, -0.007488544, -0.01826474,
        0.00051566405, -0.018315127, -0.014070149, 0.012061028, 0.020506896, 0.03393463, 0.0032687588, 0.016677598,
        0.002191769, -0.0001621783, -0.015921816, -0.0020469106, -0.017685309, -0.012665654, -0.016614616, 0.005029102,
        0.0008982789, 0.008956022, 0.016438266, -0.0023382017, 0.019499186, 0.010914758, 0.0173704, 0.0058100773,
        0.030281682, -0.021816919, 0.027308937, 0.004455967, 0.010675427, -0.012722337, 0.00979368, -0.0025476166,
        0.010864372, 0.015997395, 0.014636986, 0.021476816, -0.017534152, -0.015216419, -0.0026798784, 0.030004561,
        0.00830101, 0.009957433, 0.0042386795, -0.011525681, 0.00036096483, -0.013994571, 0.003378977, -0.011683136,
        0.005671517, -0.003816701, -0.019952655, 0.028467804, -0.014322077, -0.02563362, -0.008206537, -0.00016414649,
        0.044011727, 0.007394071, 0.006376914, 0.020229775, 0.0033978717, -0.009283527, 0.028291455, -0.02553285,
        -0.004755131, 0.033178847, 0.0013556847, 0.0006530432, -0.021716148, 0.0033569336, 0.004660658, -0.014762949,
        -0.027157782, 0.01861744, 0.02320252, -0.0024027582, -0.020897383, 0.014498426, -0.037083723, 0.018630035,
        0.00047826854, -0.01743338, -0.021035943, 0.0057533933, -0.015342383, 0.008735585, -0.026351614, 0.018516669,
        0.02733413, -0.0040024975, -0.008836356, -0.0035490282, 0.0009030025, 0.00085104245, -0.017723097, 0.025293518,
        -0.005577044, 0.011380823, 0.011002932, 0.0017115322, -0.02733413, -0.0044717127, -0.00035269847, 0.017836465,
        -0.022207405, 0.0010848626, -0.006449343, 0.0098314695, 0.00095496257, 0.014196113, -0.007702682, -0.004430774,
        -0.004323705, -0.0010730536, 0.021451624, -0.009881855, -0.0049346294, -0.013553698, -0.012489304, -0.029324356,
        -0.035446193, 0.0064367466, 0.005422739, -0.028467804, -0.008250625, -0.010480182, -0.0014438593, 0.024777066,
        0.0108769685, -0.010341623, 0.008351396, 0.026099686, -0.022270389, 0.0010037735, 0.009497666, 0.014649582,
        -0.020859594, 0.022220002, -0.0030939842, -0.015342383, 0.003945814, -0.015581714, -0.0052778805, 0.013075035,
        0.01059355, 0.005296775, -0.0032042025, 0.0048433053, 0.027384516, 0.025923336, 0.0068272343, -0.011727223,
        -0.0008423825, 0.031541318, -0.005340862, 0.0023759909, -0.0039710067, -0.0056967097, 0.005838419,
        -0.0094157895, -0.0018957541, 0.00038222122, -0.038998373, -0.0041662506, 0.0012139755, 0.013125421,
        0.005161364, -0.017622326, -0.034690414, -0.012961668, -0.033556737, 0.0025334456, 0.005369204, -0.020141602,
        0.014359865, 0.0055550006, 0.011758715, 0.0017729396, 0.008420676, -0.015543925, -0.022182213, -0.007948312,
        -0.01917168, -0.012590075, -0.004430774, 0.028417418, 0.007419264, -0.0145866005, -0.014246498, -0.005901401,
        -0.0319444, -0.022169618, -0.013389945, 0.00336953, -0.010064502, 0.0159722, -0.0077719623, 0.034413293,
        0.0018296232, 0.00347345, 0.004714193, -0.027837984, 0.009466175, -0.001618634, 0.025066784, -0.006005321,
        -0.021690955, -0.0051361714, 0.004689, 0.008426974, -0.007387773, 0.008426974, -0.013276578, -0.003133348,
        -0.01288609, 0.0027066458, -0.0038859812, 0.0055077644, 0.020569878, -0.014082746, -0.002805842, 0.00077231514,
        -0.0067642527, 0.00482756, -0.000002288013, 0.012369638, -0.012438918, 0.023907917, -0.014070149, -0.006650885,
        0.0052369423, -0.02087219, 0.022673473, -0.021816919, 0.010058204, 0.024651103, 0.010171572, 0.0027129438,
        -0.0011793354, 0.0012226355, -0.005340862, 0.0044685635, -0.0004381176, -0.009566946, 0.006783147, -0.005019655,
        -0.01711847, -0.037285265, 0.008571832, -0.02271126, -0.020834401, 0.0024531437, 0.028316647, 0.018554458,
        -0.03201998, -0.014662178, -0.019977849, 0.018403301, 0.0065186233, -0.011242263, 0.0054857205, -0.0060934955,
        -0.009289825, 0.01636269, -0.025684005, -0.006232056, 0.0094157895, 0.016828755, -0.0015721848, 0.039577805,
        0.24023803, -0.017458573, -0.009094582, 0.02090998, 0.02407167, 0.021287872, 0.007217722, -0.0014745629,
        0.0026625583, 0.0083136065, -0.008540341, 0.0017036595, -0.008282116, 0.0095165605, 0.0022862419, 0.0067957435,
        -0.024436964, -0.027485287, -0.026830275, -0.025028994, 0.0059580845, -0.030054947, -0.023630796, -0.012848301,
        0.01583364, -0.011594961, -0.008956022, -0.0050448477, 0.032271907, 0.013704854, 0.0045000543, -0.016992508,
        0.016135953, 0.008408079, -0.02184211, -0.014523619, 0.030054947, 0.006474536, 0.029777827, 0.010001521,
        -0.015052666, -0.009453578, -0.008565534, -0.0123948315, -0.0004499267, 0.010121186, 0.0019524379, -0.02871973,
        0.019524379, 0.032977305, 0.006203714, 0.012023238, 0.022875015, 0.0343881, 0.0031286243, -0.005832121,
        0.0070665656, 0.02298838, -0.013730047, -0.00068217237, -0.007967206, 0.0378647, 0.0005727413, 0.033405583,
        -0.022623086, 0.0056274296, -0.027384516, -0.007948312, 0.008867847, -0.007532631, -0.017408188, -0.0070035835,
        0.00795461, -0.006814638, -0.031793248, -0.02132566, 0.006137583, 0.011298947, 0.03393463, 0.033531547,
        -0.011714627, 0.000042365147, 0.0004207976, -0.023315888, -0.037209686, -0.040409166, -0.000029227522,
        -0.010322728, -0.015720274, -0.022522315, -0.012042133, -0.013767836, -0.0019776307, -0.005838419, 0.016942123,
        0.018907156, -0.0030451734, 0.0029995113, -0.012048431, 0.010599848, -0.006402107, 0.005995874, 0.008433272,
        -0.00051448314, 0.0012186992, 0.010574656, -0.0043426, 0.0025964275, -0.0006290314, -0.013692258, -0.020154197,
        -0.011374525, 0.004348898, 0.0017178304, -0.007633402, 0.009037898, -0.0150022805, -0.0068020415, 0.0015721848,
        -0.003153817, -0.0017131068, -0.01316321, -0.004119014, 0.0012974264, 0.0010037735, -0.020443914, -0.0034325118,
        0.009107178, 0.012779021, -0.03267499, 0.0052369423, 0.00079199695, 0.013377349, 0.0077656643, -0.0044024326,
        -0.0017351505, 0.0159722, -0.0031821588, -0.015934411, -0.0054447823, -0.007715279, -0.0058100773, 0.001979205,
        -0.008565534, -0.010045608, -0.00593919, 0.034413293, -0.022295581, -0.018378109, 0.0037033337, -0.040585514,
        -0.01107851, -0.0065942015, -0.010373114, 0.02407167, -0.017231839, -0.021968076, -0.01590922, -0.002917635,
        0.0057817353, -0.01504007, 0.017320013, 0.027384516, -0.0063548703, -0.032876533, -0.019977849, -0.16193898,
        0.01834032, 0.016715387, -0.010706917, 0.018718211, 0.015695082, 0.02462591, -0.0036844392, -0.008634814,
        0.012029536, 0.00071602507, -0.010114888, -0.021439027, -0.01826474, 0.0027286895, -0.019234663, -0.003278206,
        0.02101075, 0.035370618, 0.025091976, 0.037108917, -0.0036938866, 0.0026531112, -0.01073211, 0.008956022,
        0.00078727334, 0.003945814, 0.025973722, -0.011387122, -0.0044055814, -0.013263981, -0.030206103, 0.031113042,
        0.008137257, 0.01760973, -0.0039899014, 0.009396895, -0.04091302, -0.009138669, 0.025746986, 0.027107395,
        0.016450863, 0.009636225, -0.011815398, -0.018151375, 0.0034482572, 0.015153437, 0.008830057, 0.019033121,
        -0.0012478282, 0.0076648933, 0.0008423825, 0.004962971, -0.0015139267, 0.018881964, 0.025709199, 0.010713216,
        0.023718972, 0.009755891, -0.007116951, -0.011613856, -0.010341623, 0.0017524704, -0.0068965144, 0.012558584,
        -0.0032876534, -0.002427951, 0.016375285, -0.005967532, 0.019700728, -0.0041064178, -0.019662939, -0.010152677,
        -0.024651103, 0.010807688, 0.0021728743, -0.0406359, 0.02934955, -0.0023775655, -0.0061564776, -0.0044339234,
        0.016853947, -0.00044953308, 0.00033636254, -0.014548811, 0.004937778, -0.0019177978, 0.009579542, -0.023794549,
        -0.025091976, 0.008124661, -0.018541861, -0.014914106, -0.01697991, 0.0035868173, 0.007690086, 0.017559344,
        0.021829516, -0.005274731, -0.010366815, -0.0022547508, 0.009667717, -0.011336736, 0.004547291, 0.019070908,
        -0.012879792, 0.022648279, 0.011550874, 0.016589424, -0.027661636, -0.023769356, 0.008981214, 0.01403236,
        0.024021285, 0.01167054, 0.021262677, -0.012659355, -0.010045608, 0.0038985775, -0.008653709, 0.050964925,
        0.002393311, -0.035546966, -0.0019004778, 0.0021240634, 0.008993811, -0.07250472, -0.040333588, 0.0041725487,
        0.020166794, -0.002969595, 0.032826148, -0.0026420893, 0.004122163, 0.010580953, 0.0070098815, 0.004802367,
        -0.026024107, -0.017723097, -0.011513085, 0.04189554, -0.02209404, 0.006858725, -0.00026255567, -0.033783473,
        0.020393528, -0.015997395, 0.002087849, 0.0045441417, -0.0077341734, -0.0274349, 0.005328266, -0.025558041,
        0.036201976, 0.009195353, -0.008061679, -0.021124119, -0.012823108, -0.011960257, -0.0017477468, -0.016992508,
        0.016098166, -0.038998373, 0.029324356, 0.006745358, -0.034060594, 0.03632794, 0.012999457, -0.009189054,
        -0.047311977, -0.008741883, 0.00965512, 0.008124661, 0.03705853, 0.0128671955, -0.011935064, -0.014876317,
        -0.03733565, -0.02438658, 0.012760126, 0.016652405, -0.0034640026, 0.008987512, 0.031415354, -0.011235965,
        0.010776198, 0.005665219, 0.0037726138, -0.03144055, 0.018919753, -0.011777609, 0.010908459, -0.020658052,
        0.016715387, 0.020998154, 0.011544576, -0.019675534, 0.025507657, 0.0051771095, 0.013352156, -0.039199915,
        -0.00038733848, -0.012986861, -0.024638506, 0.016387882, -0.007979803, -0.031692475, -0.023492236,
        -0.0032215226, -0.0057911826, 0.028417418, 0.0093024215, -0.004229232, 0.0039678575, -0.015266804, -0.03257422,
        -0.02302617, 0.0067327614, 0.012029536, -0.017181452, 0.0037568684, 0.003001086, -0.012564883, 0.0025476166,
        0.010650233, 0.018919753, -0.02201846, -0.01826474, -0.067012705, 0.024323598, -0.013175807, -0.013918992,
        0.01347812, -0.01743338, 0.008722989, -0.021892497, 0.00007587347, -0.007690086, -0.021388642, -0.005397546,
        -0.0014540938, 0.0031868825, -0.023467043, 0.0038292974, 0.020607667, 0.014599197, 0.010083397, -0.0011998046,
        0.0048433053, -0.025746986, -0.019058313, 0.009711804, -0.01844109, 0.008408079, -0.0330025, 0.0048622,
        -0.0054542297, -0.011859486, 0.0048999893, -0.044364426, -0.0011974428, 0.031163428, 0.0019099251, -0.009913346,
        0.00354273, 0.013981975, 0.009894451, 0.023051362, -0.03310327, -0.023454446, 0.016274514, -0.0035868173,
        -0.00040170623, -0.00021315426, -0.0029507005, -0.011676838, 0.020846998, 0.010196764, -0.004059181,
        0.025973722, -0.021829516, -0.0068965144, -0.023907917, -0.008452167, -0.02077142, -0.006474536, -0.008861548,
        -0.038922794, 0.02017939, 0.0023854382, 0.022257792, -0.010505375, 0.009573244, 0.0027192421, -0.021161906,
        -0.0043677925, -0.018100988, -0.030054947, -0.0059927246, -0.008080574, 0.004512651, 0.014044956, 0.021816919,
        0.016173743, -0.008345097, 0.021514606, -0.040509935, 0.03529504, 0.01660202, 0.024021285, -0.028291455,
        -0.001587143, 0.029500706, 0.0031679878, -0.008338799, -0.013125421, -0.006751656, 0.010127484, -0.026704311,
        -0.018806385, 0.005400695, 0.029601477, -0.004512651, 0.00025251793, 0.01816397, 0.008036486, 0.021728745,
        0.01994006, 0.0038891302, 0.008748181, -0.005671517, 0.0006573732, -0.016350092, -0.0023019873, -0.009667717,
        -0.032876533, -0.004783473, 0.014926703, 0.0069720927, 0.020229775, 0.0014296884, 0.013188403, -0.030936694,
        -0.0021209144, 0.021451624, -0.010203063, -0.03156651, 0.039603, -0.0063706157, -0.005501466, 0.030583994,
        -0.026351614, 0.009189054, 0.0008337225, -0.0037694648, -0.006480834, 0.020406125, -0.00064044684, 0.016413074,
        -0.003674992, -0.011298947, -0.018743403, -0.007620806, 0.00239646, -0.009749593, 0.021363448, -0.012312955,
        0.06409035, -0.007217722, -0.008074275, 0.016098166, 0.016299708, 0.018063199, 0.017571941, 0.022597894,
        -0.008408079, -0.022031058, -0.01264046, 0.007324791, -0.0052495385, -0.021350853, -0.015103051, 0.0036623955,
        -0.02104854, -0.0012423174, -0.0078097517, 0.011160387, 0.021350853, 0.0071988273, 0.013314366, 0.012350744,
        -0.019222066, -0.01747117, 0.010095993, 0.0061218375, -0.016778369, -0.028417418, 0.015052666, 0.00604311,
        -0.00073924963, -0.007230318, 0.0050479965, -0.00033911798, -0.005265284, -0.0067201653, 0.006814638,
        0.009925942, 0.017068086, 0.0021130417, -0.014964491, -0.034060594, 0.013377349, 0.005936041, -0.030987078,
        -0.012577479, -0.0076082093
      ],
      isError: false
    }
  },
  {
    input: '[-0.0048622,0.004893691,-0.01636269,-0.024474753,-0.017320013,"a"]',
    type: 'vector',
    extraColumn: { vector: { dimension: 6 } },
    expected: {
      value: [-0.0048622, 0.004893691, -0.01636269, -0.024474753, -0.017320013, 'a'],
      isError: true
    }
  },
  {
    input: '[-0.0048622,0.004893691,-0.01636269,-0.024474753,-0.017320013]',
    type: 'vector',
    extraColumn: { vector: { dimension: 50 } },
    expected: {
      value: [-0.0048622, 0.004893691, -0.01636269, -0.024474753, -0.017320013],
      isError: true
    }
  }
];

describe('coerceValue', () => {
  for (const { input, type, options, expected, extraColumn } of coerceTestCases) {
    const column: Schemas.Column = { name: 'column', type, ...extraColumn };
    test(`coerceValue ${JSON.stringify(input)} should return ${JSON.stringify(expected)}`, async () => {
      const result = await coerceValue(input, column, options);
      expect(result).toEqual(expected);
    });
  }
});

const coerceRowsTestCases: {
  rows: Record<string, unknown>[];
  columns: Schemas.Column[];
  options?: ColumnOptions;
  expected: Record<string, CoercedValue>[];
}[] = [
  {
    rows: [{ col: '1' }, { col: '-2' }],
    columns: [{ name: 'col', type: 'int' }],
    expected: [{ col: { value: 1, isError: false } }, { col: { value: -2, isError: false } }]
  },
  {
    rows: [{ col: '1.1' }, { col: '-1.1' }],
    columns: [{ name: 'col', type: 'int' }],
    expected: [{ col: { value: 1, isError: false } }, { col: { value: -1, isError: false } }]
  },
  {
    rows: [{ col: '1.0' }],
    columns: [{ name: 'col', type: 'float' }],
    expected: [{ col: { value: 1.0, isError: false } }]
  },
  {
    rows: [{ col: '1000' }],
    columns: [{ name: 'col', type: 'float' }],
    expected: [{ col: { value: 1000.0, isError: false } }]
  },
  {
    rows: [{ col: '-1.1' }],
    columns: [{ name: 'col', type: 'float' }],
    expected: [{ col: { value: -1.1, isError: false } }]
  },
  {
    rows: [{ col: 'banana' }],
    columns: [{ name: 'col', type: 'float' }],
    expected: [{ col: { value: null, isError: true } }]
  },
  {
    rows: [{ col: '1.1' }],
    columns: [{ name: 'col', type: 'string' }],
    expected: [{ col: { value: '1.1', isError: false } }]
  },
  {
    rows: [{ col: '1' }],
    columns: [{ name: 'col', type: 'string' }],
    expected: [{ col: { value: '1', isError: false } }]
  },
  {
    rows: [{ col: 'null' }],
    columns: [{ name: 'col', type: 'string' }],
    expected: [{ col: { value: null, isError: false } }]
  },
  {
    rows: [{ col: 'true' }],
    columns: [{ name: 'col', type: 'bool' }],
    expected: [{ col: { value: true, isError: false } }]
  },
  {
    rows: [{ col: 'false' }],
    columns: [{ name: 'col', type: 'bool' }],
    expected: [{ col: { value: false, isError: false } }]
  },
  {
    rows: [{ col: 'T' }],
    columns: [{ name: 'col', type: 'bool' }],
    expected: [{ col: { value: true, isError: false } }]
  },
  {
    rows: [{ col: 'notABool' }],
    columns: [{ name: 'col', type: 'bool' }],
    expected: [{ col: { value: null, isError: true } }]
  },
  {
    rows: [{ col: 'something' }],
    columns: [{ name: 'col', type: 'text' }],
    expected: [{ col: { value: 'something', isError: false } }]
  },
  {
    rows: [{ col: 'something' }],
    columns: [{ name: 'col', type: 'string' }],
    expected: [{ col: { value: 'something', isError: false } }]
  },
  {
    rows: [{ col: 'johnrandall@schmidt-hoover.biz' }],
    columns: [{ name: 'col', type: 'email' }],
    expected: [{ col: { value: 'johnrandall@schmidt-hoover.biz', isError: false } }]
  },
  {
    rows: [{ col: 'not_an_email' }],
    columns: [{ name: 'col', type: 'email' }],
    expected: [{ col: { value: null, isError: true } }]
  },
  {
    rows: [{ col: '2000-01-01' }],
    columns: [{ name: 'col', type: 'datetime' }],
    expected: [{ col: { value: new Date('2000-01-01'), isError: false } }]
  },
  {
    rows: [{ col: 'something,else' }],
    columns: [{ name: 'col', type: 'multiple' }],
    expected: [{ col: { value: ['something', 'else'], isError: false } }]
  },
  {
    rows: [{ col: '["something","else"]' }],
    columns: [{ name: 'col', type: 'multiple' }],
    expected: [{ col: { value: ['something', 'else'], isError: false } }]
  },
  {
    rows: [{ col: 'something' }],
    columns: [{ name: 'col', type: 'multiple' }],
    expected: [{ col: { value: ['something'], isError: false } }]
  },
  {
    rows: [{ col: 'something' }],
    columns: [{ name: 'col', type: 'datetime' }],
    expected: [{ col: { value: null, isError: true } }]
  },
  {
    rows: [{ col1: '1', col2: 'true' }],
    columns: [
      { name: 'col1', type: 'int' },
      { name: 'col2', type: 'bool' }
    ],
    expected: [{ col1: { value: 1, isError: false }, col2: { value: true, isError: false } }]
  },
  {
    rows: [{ link1: 'rec_xyz' }],
    columns: [{ name: 'link1', type: 'link', link: { table: 'myLink' } }],
    expected: [{ link1: { value: 'rec_xyz', isError: false } }]
  }
];

describe('coerceRows', () => {
  for (const { rows, columns, options, expected } of coerceRowsTestCases) {
    test(`coerceRows ${JSON.stringify(rows)} returns ${JSON.stringify(expected)}`, async () => {
      expect(await coerceRows(rows, columns, options)).toEqual(expected);
    });
  }
});

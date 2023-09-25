import { Schemas } from '@xata.io/client';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
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

const guessNullTestCases = [
  { input: [undefined], expected: 'string' },
  { input: ['null'], expected: 'string' },
  { input: [' null'], expected: 'string' },
  { input: ['NULL'], expected: 'string' },
  { input: [null], expected: 'string' },
  { input: [''], expected: 'string' }
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
  describe('schema guessing for nulls', () => {
    for (const { input, expected } of guessNullTestCases) {
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

const coerceTestCases: { input: unknown; type: Schemas.Column['type']; options?: ColumnOptions; expected: unknown }[] =
  [
    { input: '1', type: 'int', expected: { value: 1, isError: false } },
    { input: ' 1 ', type: 'int', expected: { value: 1, isError: false } },
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
    // Remote file test
    // {
    //   input: 'https://i.imgur.com/byMVuLJ.png',
    //   type: 'file',
    //   expected: { value: {}, isError: false }
    // },
    // {
    // Remote files test
    //   input: 'https://i.imgur.com/byMVuLJ.png|https://i.imgur.com/byMVuLJ.png',
    //   type: 'file[]',
    //   expected: { value: {}, isError: false }
    // },
    {
      // Local file test
      input: tempFile,
      type: 'file',
      expected: {
        value: {
          base64Content: 'aGVsbG8gd29ybGQ=',
          mediaType: 'application/octet-stream',
          name: 'upload'
        },
        isError: false
      }
    },
    {
      // Local files test
      input: `${tempFile}|${tempFile}`,
      type: 'file[]',
      expected: {
        value: [
          {
            base64Content: 'aGVsbG8gd29ybGQ=',
            mediaType: 'application/octet-stream',
            name: 'upload'
          },
          {
            base64Content: 'aGVsbG8gd29ybGQ=',
            mediaType: 'application/octet-stream',
            name: 'upload'
          }
        ],
        isError: false
      }
    },
    // excel formats
    // { input: '2/4/1964', type: 'datetime', expected: {value: new Date('1964-04-02') }},
    // { input: '02/04/1964', type: 'datetime', expected: {value: new Date('1964-04-02') }},
    // { input: '02/04/1964 05:56', type: 'datetime', expected: {value: new Date('1964-04-02T05:56:00.000Z') }},
    // { input: '05/02/1968 17:44:00', type: 'datetime', expected: {value: new Date('1968-02-05T17:44:00.000Z') }},
    { input: '2000-01-01', type: 'datetime', expected: { value: new Date('2000-01-01'), isError: false } },
    { input: 'something', type: 'datetime', expected: { value: null, isError: true } }
  ];

describe('coerceValue', () => {
  for (const { input, type, options, expected } of coerceTestCases) {
    test(`coerceValue ${JSON.stringify(input)} returns ${JSON.stringify(expected)}`, async () => {
      expect(await coerceValue(input, type, options)).toEqual(expected);
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

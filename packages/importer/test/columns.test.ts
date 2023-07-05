import { Schemas } from '@xata.io/client';
import { describe, expect, test } from 'vitest';
import { coerceRows, coerceValue, guessColumns, guessColumnTypes } from '../src/columns';
import { ColumnOptions } from '../src/types';
import { yepNopeToBoolean } from './utils';

const guessNumbersTestCases = [
  { input: ['1', '2', '3'], expected: 'int' },
  { input: ['1', '2', '3', null], expected: 'int' },
  { input: ['1', '2', '3.0'], expected: 'float' },
  { input: ['1', '2', '3.1'], expected: 'float' },
  { input: ['1', '2', '3.1', '3.2'], expected: 'float' },
  { input: ['1', 2], expected: 'int' },
  { input: ['1', 2, '3.1'], expected: 'float' },
  { input: ['1', 2, 3.2], expected: 'float' },
  { input: ['1', 2, 3.2, 'null'], expected: 'float' },
  { input: ['foo', 2, 3.2, '3.3'], expected: 'string' }
];

const guessBooleansTestCases = [
  { input: ['true', 'false'], expected: 'bool' },
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
  { input: ['foo', 'email@example.com'], expected: 'string' },
  { input: [2, 'email@example.com'], expected: 'string' },
  { input: ['email+1@example.com'], expected: 'email' },
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
  { input: ['2020-01-01T00:00:00+00:00'], expected: 'datetime' },
  { input: ['2020-01-01T00:00:00+01:00'], expected: 'datetime' },
  // excel formats
  { input: ['02/04/1964'], expected: 'datetime' },
  { input: ['02/04/1964 05:56'], expected: 'datetime' },
  { input: ['05/02/1968 17:44:00'], expected: 'datetime' },
  { input: ['today', 'yesterday'], expected: 'datetime' }
  // todo: add invalid test cases with more variety
];

const guessNullTestCases = [
  { input: [undefined], expected: 'string' },
  { input: ['null'], expected: 'string' },
  { input: ['NULL'], expected: 'string' },
  { input: [null], expected: 'string' },
  { input: [''], expected: 'string' }
];

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
  { input: [{ nullValue: null }], expected: [{ type: 'string', name: 'nullValue' }] },
  { input: [{ undefinedValue: undefined }], expected: [{ type: 'string', name: 'undefinedValue' }] },
  { input: [{ obj: { key: 'value' } }], expected: [{ type: 'string', name: 'obj' }] },
  { input: [{ arr: [1, 2, 3] }], expected: [{ type: 'string', name: 'arr' }] },
  { input: [{ booleanStrings: ['true', 'false'] }], expected: [{ type: 'string', name: 'booleanStrings' }] },
  { input: [{ booleanMixed: ['true', false] }], expected: [{ type: 'string', name: 'booleanMixed' }] },
  { input: [{ mixedNumbers: ['1', 2, '3.0'] }], expected: [{ type: 'string', name: 'mixedNumbers' }] },
  { input: [{ dateStrings: ['2020-01-01', '2020-01-02'] }], expected: [{ type: 'string', name: 'dateStrings' }] },
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
  }
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
    { input: '1', type: 'int', expected: 1 },
    { input: '1', type: 'float', expected: 1.0 },
    { input: '1.1', type: 'float', expected: 1.1 },
    { input: 'banana', type: 'float', expected: null },
    { input: '1.1', type: 'string', expected: '1.1' },
    { input: '1', type: 'string', expected: '1' },
    { input: 'true', type: 'bool', expected: true },
    {
      input: 'nope',
      type: 'bool',
      expected: false,
      options: { toBoolean: yepNopeToBoolean }
    },
    { input: 'false', type: 'bool', expected: false },
    { input: 'T', type: 'bool', expected: true },
    { input: 'notABool', type: 'bool', expected: null },
    { input: 'something', type: 'text', expected: 'something' },
    { input: 'something', type: 'string', expected: 'something' },
    { input: '2000-01-01', type: 'datetime', expected: new Date('2000-01-01') },
    { input: '2020-01-01T00:00:00Z', type: 'datetime', expected: new Date('2020-01-01T00:00:00Z') },
    { input: '2020-01-01T00:00:00+00:00', type: 'datetime', expected: new Date('2020-01-01T00:00:00+00:00') },
    { input: '2020-01-01T00:00:00+01:00', type: 'datetime', expected: new Date('2020-01-01T00:00:00+01:00') },
    // excel formats
    { input: '02/04/1964', type: 'datetime', expected: new Date('1964-04-02') },
    { input: '02/04/1964 05:56', type: 'datetime', expected: new Date('1964-04-02T05:56:00.000Z') },
    { input: '05/02/1968 17:44:00', type: 'datetime', expected: new Date('1968-02-05T17:44:00.000Z') },
    { input: '2000-01-01', type: 'datetime', expected: new Date('2000-01-01') },
    { input: 'something', type: 'datetime', expected: null }
  ];

describe('coerceValue', () => {
  for (const { input, type, options, expected } of coerceTestCases) {
    test(`coerceValue ${JSON.stringify(input)} returns ${JSON.stringify(expected)}`, () => {
      expect(coerceValue(input, type, options)).toEqual(expected);
    });
  }
});

const coerceRowsTestCases: {
  rows: Record<string, unknown>[];
  columns: Schemas.Column[];
  options?: ColumnOptions;
  expected: Record<string, unknown>[];
}[] = [
  {
    rows: [{ value: '1' }],
    columns: [{ name: 'value', type: 'int' }],
    expected: [{ value: 1 }]
  },
  {
    rows: [{ value: '1.0' }],
    columns: [{ name: 'value', type: 'float' }],
    expected: [{ value: 1.0 }]
  },
  {
    rows: [{ value: '1.1' }],
    columns: [{ name: 'value', type: 'float' }],
    expected: [{ value: 1.1 }]
  },
  {
    rows: [{ value: 'banana' }],
    columns: [{ name: 'value', type: 'float' }],
    expected: [{ value: null }]
  },
  {
    rows: [{ value: '1.1' }],
    columns: [{ name: 'value', type: 'string' }],
    expected: [{ value: '1.1' }]
  },
  {
    rows: [{ value: '1' }],
    columns: [{ name: 'value', type: 'string' }],
    expected: [{ value: '1' }]
  },
  {
    rows: [{ value: 'true' }],
    columns: [{ name: 'value', type: 'bool' }],
    expected: [{ value: true }]
  },
  {
    rows: [{ value: 'false' }],
    columns: [{ name: 'value', type: 'bool' }],
    expected: [{ value: false }]
  },
  {
    rows: [{ value: 'T' }],
    columns: [{ name: 'value', type: 'bool' }],
    expected: [{ value: true }]
  },
  {
    rows: [{ value: 'notABool' }],
    columns: [{ name: 'value', type: 'bool' }],
    expected: [{ value: null }]
  },
  {
    rows: [{ value: 'something' }],
    columns: [{ name: 'value', type: 'text' }],
    expected: [{ value: 'something' }]
  },
  {
    rows: [{ value: 'something' }],
    columns: [{ name: 'value', type: 'string' }],
    expected: [{ value: 'something' }]
  },
  {
    rows: [{ value: '2000-01-01' }],
    columns: [{ name: 'value', type: 'datetime' }],
    expected: [{ value: new Date('2000-01-01') }]
  },
  {
    rows: [{ value: 'something' }],
    columns: [{ name: 'value', type: 'datetime' }],
    expected: [{ value: null }]
  },
  {
    rows: [{ value1: '1', value2: 'true' }],
    columns: [
      { name: 'value1', type: 'int' },
      { name: 'value2', type: 'bool' }
    ],
    expected: [{ value1: 1, value2: true }]
  }
];

describe('coerceRows', () => {
  for (const { rows, columns, options, expected } of coerceRowsTestCases) {
    test(`coerceRows ${JSON.stringify(rows)} returns ${JSON.stringify(expected)}`, () => {
      expect(coerceRows(rows, columns, options)).toEqual(expected);
    });
  }
});

import { expect, test, describe } from 'vitest';
import { guessColumnTypes } from '../src/columns';

const guessNumbersTestCases = [
  { input: ['1', '2', '3'], expected: 'int' },
  { input: ['1', '2', '3.0'], expected: 'float' },
  { input: ['1', '2', '3.1'], expected: 'float' },
  { input: ['1', '2', '3.1', '3.2'], expected: 'float' },
  { input: ['1', 2], expected: 'int' },
  { input: ['1', 2, '3.1'], expected: 'float' },
  { input: ['1', 2, 3.2], expected: 'float' },
  { input: ['foo', 2, 3.2, '3.3'], expected: 'string' }
];

const guessBooleansTestCases = [
  { input: ['true', 'false'], expected: 'bool' },
  { input: ['true', 'false', 'true'], expected: 'bool' },
  { input: ['true', 'false', true], expected: 'bool' },
  { input: ['true', 'false', true, 'false'], expected: 'bool' },
  { input: ['true', 'false', true, 'false', 'foo'], expected: 'string' }
];

const guessEmailsTestCases = [
  { input: ['email@example.com'], expected: 'email' },
  { input: ['foo', 'email@example.com'], expected: 'string' },
  { input: [2, 'email@example.com'], expected: 'string' },
  { input: ['email+1@example.com'], expected: 'email' }
];

const guessTextTestCases = [
  { input: ['foo', 'bar'], expected: 'string' },
  { input: ['foo', 'bar', 'baz'], expected: 'string' },
  { input: ['foo', 'bar', 'baz', 'qux'], expected: 'string' },
  { input: ['foo'.repeat(150)], expected: 'text' },
  { input: ['foo', 'foo'.repeat(150)], expected: 'text' }
];

const guessDatesTestCases = [
  { input: [new Date()], expected: 'datetime' },
  { input: ['2020-01-01'], expected: 'datetime' },
  { input: ['2020-01-01', '2020-01-02'], expected: 'datetime' },
  { input: ['2020-01-01', 'foo'], expected: 'string' },
  { input: ['2020-01-01T00:00:00Z'], expected: 'datetime' },
  { input: ['2020-01-01T00:00:00+00:00'], expected: 'datetime' },
  { input: ['2020-01-01T00:00:00+01:00'], expected: 'datetime' },
  { input: ['today', 'yesterday'], expected: 'datetime' }
];

describe('schema guessing for numbers', () => {
  for (const { input, expected } of guessNumbersTestCases) {
    test(`guesses ${expected} for ${JSON.stringify(input)}`, () => {
      expect(guessColumnTypes(input)).toEqual(expected);
    });
  }
});

test('schema guessing for booleans', () => {
  for (const { input, expected } of guessBooleansTestCases) {
    test(`guesses ${expected} for ${JSON.stringify(input)}`, () => {
      expect(guessColumnTypes(input)).toEqual(expected);
    });
  }
});

test('schema guessing for emails', () => {
  for (const { input, expected } of guessEmailsTestCases) {
    test(`guesses ${expected} for ${JSON.stringify(input)}`, () => {
      expect(guessColumnTypes(input)).toEqual(expected);
    });
  }
});

test('schema guessing for text', () => {
  for (const { input, expected } of guessTextTestCases) {
    test(`guesses ${expected} for ${JSON.stringify(input)}`, () => {
      expect(guessColumnTypes(input)).toEqual(expected);
    });
  }
});

test('schema guessing for dates', () => {
  for (const { input, expected } of guessDatesTestCases) {
    test(`guesses ${expected} for ${JSON.stringify(input)}`, () => {
      expect(guessColumnTypes<string | Date>(input)).toEqual(expected);
    });
  }
});

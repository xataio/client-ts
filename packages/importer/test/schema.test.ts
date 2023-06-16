import { expect, test } from 'vitest';
import { guessColumnTypes } from '../src/columns';

function assertEquals(a: any, b: any) {
  expect(a).toEqual(b);
}

test('schema guessing for numbers', () => {
  assertEquals(guessColumnTypes(['1', '2', '3']), 'int');
  assertEquals(guessColumnTypes(['1', '2', '3.0']), 'float');
  assertEquals(guessColumnTypes(['1', '2', '3.1']), 'float');
  assertEquals(guessColumnTypes(['1', '2', '3.1', '3.2']), 'float');
  assertEquals(guessColumnTypes(['1', 2]), 'int');
  assertEquals(guessColumnTypes(['1', 2, '3.1']), 'float');
  assertEquals(guessColumnTypes(['1', 2, 3.2]), 'float');
  assertEquals(guessColumnTypes(['foo', 2, 3.2, '3.3']), 'string');
});

test('schema guessing for booleans', () => {
  assertEquals(guessColumnTypes(['true', 'false']), 'bool');
  assertEquals(guessColumnTypes(['true', 'false', 'true']), 'bool');
  assertEquals(guessColumnTypes(['true', 'false', true]), 'bool');
  assertEquals(guessColumnTypes(['true', 'false', true, 'false']), 'bool');
  assertEquals(guessColumnTypes(['true', 'false', true, 'false', 'foo']), 'string');
});

test('schema guessing for emails', () => {
  assertEquals(guessColumnTypes(['email@example.com']), 'email');
  assertEquals(guessColumnTypes(['foo', 'email@example.com']), 'string');
  assertEquals(guessColumnTypes([2, 'email@example.com']), 'string');
});

test('schema guessing for text', () => {
  assertEquals(guessColumnTypes(['foo', 'bar']), 'string');
  assertEquals(guessColumnTypes(['foo', 'bar', 'baz']), 'string');
  assertEquals(guessColumnTypes(['foo', 'bar', 'baz', 'qux']), 'string');

  const longText = 'foo'.repeat(150);
  assertEquals(guessColumnTypes([longText]), 'text');
  assertEquals(guessColumnTypes(['foo', longText]), 'text');
});

test('schema guessing for dates', () => {
  assertEquals(guessColumnTypes([new Date()]), 'datetime');
  assertEquals(guessColumnTypes(['2020-01-01']), 'datetime');
  assertEquals(guessColumnTypes(['2020-01-01', '2020-01-02']), 'datetime');
  assertEquals(guessColumnTypes(['2020-01-01', 'foo']), 'string');
  assertEquals(guessColumnTypes(['2020-01-01T00:00:00Z']), 'datetime');
  assertEquals(guessColumnTypes(['2020-01-01T00:00:00+00:00']), 'datetime');
  assertEquals(guessColumnTypes(['2020-01-01T00:00:00+01:00']), 'datetime');
  assertEquals(guessColumnTypes(['today', 'yesterday']), 'datetime');
});

test('schema guessing for multiple', () => {
  assertEquals(guessColumnTypes([[1, 2, 3]]), 'multiple');
  assertEquals(
    guessColumnTypes([
      [1, 2, 3],
      ['foo', '5', false]
    ]),
    'multiple'
  );
  assertEquals(guessColumnTypes([['foo'], [1, 2, 3]]), 'multiple');
  assertEquals(guessColumnTypes([JSON.stringify([1, 2, 3])]), 'multiple');
  assertEquals(guessColumnTypes([`1,foo,3`, 'foo;bar']), 'multiple');
  assertEquals(guessColumnTypes([`1,foo,3`, 'foo;bar', 'baz']), 'string');
});

test('schema guessing', () => {
  const object = {
    code: 'HAM',
    dob: '1985-06-27',
    driverId: 1,
    driverRef: 'hamilton',
    forename: 'Lewis',
    nationality: 'British',
    number: 44,
    surname: 'Hamilton',
    url: 'http://en.wikipedia.org/wiki/Lewis_Hamilton'
  };

  const guess = Object.fromEntries(Object.entries(object).map(([key, value]) => [key, guessColumnTypes([value])]));

  expect(guess).toEqual({
    code: 'string',
    dob: 'datetime',
    driverId: 'int',
    driverRef: 'string',
    forename: 'string',
    nationality: 'string',
    number: 'int',
    surname: 'string',
    url: 'string'
  });
});

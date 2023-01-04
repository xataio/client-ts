import { expect, test } from 'vitest';
import { guessSchemaTypes } from '../src/schema';

function assertEquals(a: any, b: any) {
  expect(a).toEqual(b);
}

test('schema guessing for numbers', () => {
  assertEquals(guessSchemaTypes(['1', '2', '3']), 'int');
  assertEquals(guessSchemaTypes(['1', '2', '3.0']), 'float');
  assertEquals(guessSchemaTypes(['1', '2', '3.1']), 'float');
  assertEquals(guessSchemaTypes(['1', '2', '3.1', '3.2']), 'float');
  assertEquals(guessSchemaTypes(['1', 2]), 'int');
  assertEquals(guessSchemaTypes(['1', 2, '3.1']), 'float');
  assertEquals(guessSchemaTypes(['1', 2, 3.2]), 'float');
  assertEquals(guessSchemaTypes(['foo', 2, 3.2, '3.3']), 'string');
});

test('schema guessing for booleans', () => {
  assertEquals(guessSchemaTypes(['true', 'false']), 'bool');
  assertEquals(guessSchemaTypes(['true', 'false', 'true']), 'bool');
  assertEquals(guessSchemaTypes(['true', 'false', true]), 'bool');
  assertEquals(guessSchemaTypes(['true', 'false', true, 'false']), 'bool');
  assertEquals(guessSchemaTypes(['true', 'false', true, 'false', 'foo']), 'string');
});

test('schema guessing for emails', () => {
  assertEquals(guessSchemaTypes(['email@example.com']), 'email');
  assertEquals(guessSchemaTypes(['foo', 'email@example.com']), 'string');
  assertEquals(guessSchemaTypes([2, 'email@example.com']), 'string');
});

test('schema guessing for text', () => {
  assertEquals(guessSchemaTypes(['foo', 'bar']), 'string');
  assertEquals(guessSchemaTypes(['foo', 'bar', 'baz']), 'string');
  assertEquals(guessSchemaTypes(['foo', 'bar', 'baz', 'qux']), 'string');

  const longText = 'foo'.repeat(150);
  assertEquals(guessSchemaTypes([longText]), 'text');
  assertEquals(guessSchemaTypes(['foo', longText]), 'text');
});

test('schema guessing for dates', () => {
  assertEquals(guessSchemaTypes([new Date()]), 'datetime');
  assertEquals(guessSchemaTypes(['2020-01-01']), 'datetime');
  assertEquals(guessSchemaTypes(['2020-01-01', '2020-01-02']), 'datetime');
  assertEquals(guessSchemaTypes(['2020-01-01', 'foo']), 'string');
  assertEquals(guessSchemaTypes(['2020-01-01T00:00:00Z']), 'datetime');
  assertEquals(guessSchemaTypes(['2020-01-01T00:00:00+00:00']), 'datetime');
  assertEquals(guessSchemaTypes(['2020-01-01T00:00:00+01:00']), 'datetime');
  assertEquals(guessSchemaTypes(['today', 'yesterday']), 'datetime');
});

test('schema guessing for multiple', () => {
  assertEquals(guessSchemaTypes([[1, 2, 3]]), 'multiple');
  assertEquals(
    guessSchemaTypes([
      [1, 2, 3],
      ['foo', '5', false]
    ]),
    'multiple'
  );
  assertEquals(guessSchemaTypes([['foo'], [1, 2, 3]]), 'multiple');
  assertEquals(guessSchemaTypes([JSON.stringify([1, 2, 3])]), 'multiple');
  assertEquals(guessSchemaTypes([`1,foo,3`, 'foo;bar']), 'multiple');
  assertEquals(guessSchemaTypes([`1,foo,3`, 'foo;bar', 'baz']), 'string');
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

  const guess = Object.fromEntries(Object.entries(object).map(([key, value]) => [key, guessSchemaTypes([value])]));

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

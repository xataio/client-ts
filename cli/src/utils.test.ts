import { describe, expect, test } from 'vitest';
import { pluralize, slugify } from './utils';

describe('pluralize', () => {
  test('pluralizes words', async () => {
    expect(pluralize('foo', 0)).toEqual('foos');
    expect(pluralize('foo', 1)).toEqual('foo');
    expect(pluralize('foo', 2)).toEqual('foos');
  });
});

describe('slugify', () => {
  test('slugs words', async () => {
    expect(slugify('1')).toEqual('1');
    expect(slugify('Acme')).toEqual('acme');
    expect(slugify('Acme Inc')).toEqual('acme-inc');
    expect(slugify('Acme Inc.')).toEqual('acme-inc');
  });

  test('makes sure the slug is not empty and starts with alphanumeric', async () => {
    expect(slugify('')).toEqual('x');
    expect(slugify('~foo')).toEqual('x~foo');
  });
});

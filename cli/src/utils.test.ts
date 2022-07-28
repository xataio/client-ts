import { describe, expect, test } from 'vitest';
import { pluralize, slug } from './utils';

describe('pluralize', () => {
  test('pluralizes words', async () => {
    expect(pluralize('foo', 0)).toEqual('foos');
    expect(pluralize('foo', 1)).toEqual('foo');
    expect(pluralize('foo', 2)).toEqual('foos');
  });
});

describe('slug', () => {
  test('slugs words', async () => {
    expect(slug('1')).toEqual('1');
    expect(slug('Acme')).toEqual('Acme');
    expect(slug('Acme Inc')).toEqual('Acme-Inc');
    expect(slug('Acme Inc.')).toEqual('Acme-Inc');
  });

  test('makes sure the slug is not empty and starts with alphanumeric', async () => {
    expect(slug('')).toEqual('a');
    expect(slug('~foo')).toEqual('a~foo');
  });

  test('replaces symbols', async () => {
    expect(slug('<')).toEqual('less');
  });
});

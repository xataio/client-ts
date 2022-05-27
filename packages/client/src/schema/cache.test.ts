import { describe, expect, test } from 'vitest';
import { SimpleCache } from './cache';

const cache = new SimpleCache({ max: 5 });

describe('simple cache', () => {
  test('no cache', async () => {
    const noCache = new SimpleCache({ max: 0 });

    await noCache.set('foo', 'bar');
    expect(await noCache.get('foo')).toBe(null);
  });

  test('useless cache', async () => {
    const uselessCache = new SimpleCache({ max: 1 });

    await uselessCache.set('foo', 'bar');
    expect(await uselessCache.get('foo')).toBe('bar');
  });

  test('cache', async () => {
    await cache.set('foo', 'bar');
    expect(await cache.get('foo')).toBe('bar');
  });

  test('cache with delete', async () => {
    await cache.set('foo', 'bar');
    await cache.delete('foo');
    expect(await cache.get('foo')).toBe(null);
  });

  test('cache with clear', async () => {
    await cache.set('foo', 'bar');
    await cache.clear();
    expect(await cache.get('foo')).toBe(null);
  });

  test('cache with getAll', async () => {
    await cache.set('foo', 'bar');
    await cache.set('bar', 'foo');
    expect(await cache.getAll()).toEqual({ foo: 'bar', bar: 'foo' });
  });

  test('cache with getAll and delete', async () => {
    await cache.set('foo', 'bar');
    await cache.set('bar', 'foo');
    await cache.delete('foo');
    expect(await cache.getAll()).toEqual({ bar: 'foo' });
  });

  test('cache with getAll and clear', async () => {
    await cache.set('foo', 'bar');
    await cache.set('bar', 'foo');
    await cache.clear();
    expect(await cache.getAll()).toEqual({});
  });

  test('cache with max size', async () => {
    await cache.set('foo', 'bar');
    await cache.set('bar', 'foo');
    await cache.set('baz', 'foo');
    await cache.set('qux', 'foo');
    await cache.set('quux', 'foo');
    await cache.set('corge', 'foo');
    await cache.set('grault', 'foo');
    expect(await cache.getAll()).toMatchInlineSnapshot(`
      {
        "baz": "foo",
        "corge": "foo",
        "grault": "foo",
        "quux": "foo",
        "qux": "foo",
      }
    `);
  });

  test('cache with max size, least recently used', async () => {
    await cache.set('foo', 'bar');
    await cache.set('bar', 'foo');
    await cache.set('baz', 'foo');
    await cache.set('qux', 'foo');
    await cache.set('foo', 'bar');
    await cache.set('quux', 'foo');
    await cache.set('corge', 'foo');
    await cache.set('grault', 'foo');
    expect(await cache.getAll()).toMatchInlineSnapshot(`
      {
        "corge": "foo",
        "foo": "bar",
        "grault": "foo",
        "quux": "foo",
        "qux": "foo",
      }
    `);
  });
});

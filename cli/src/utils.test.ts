import { describe, expect, test } from 'vitest';
import { pluralize } from './utils';

describe('pluralize', () => {
  test('pluralizes words', async () => {
    expect(pluralize('foo', 0)).toEqual('foos');
    expect(pluralize('foo', 1)).toEqual('foo');
    expect(pluralize('foo', 2)).toEqual('foos');
  });
});

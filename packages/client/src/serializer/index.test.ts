import { describe, expect, test } from 'vitest';
import { deserialize, serialize } from '.';

describe('simple cache', () => {
  test('serialize and deserialize', async () => {
    const original = { a: 1, b: 2, c: new Date('2022-01-01'), d: { foo: { bar: false } }, e: 1.8 };

    const json = serialize(original);

    expect(json).toMatchInlineSnapshot(
      `"{"__":"Object","a":1,"b":2,"c":{"__":"Date","___":"2022-01-01T00:00:00.000Z"},"d":{"__":"Object","foo":{"__":"Object","bar":false}},"e":1.8}"`
    );

    const data = deserialize<any>(json);

    expect(data).toMatchInlineSnapshot(`
      {
        "a": 1,
        "b": 2,
        "c": 2022-01-01T00:00:00.000Z,
        "d": {
          "foo": {
            "bar": false,
          },
        },
        "e": 1.8,
      }
    `);

    expect(data).toEqual(original);
    expect(data.c instanceof Date).toBe(true);
    expect(data.d.foo.bar).toBe(false);
  });
});

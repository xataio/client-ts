import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { XataClient } from '../../packages/codegen/example/xata';
import { setUpTestEnvironment, TestEnvironmentResult } from '../utils/setup';

let xata: XataClient;
let hooks: TestEnvironmentResult['hooks'];

beforeAll(async (ctx) => {
  const result = await setUpTestEnvironment('summarize');

  xata = result.client;
  hooks = result.hooks;

  await hooks.beforeAll(ctx);

  const [pet1, pet2, pet3] = await xata.db.pets.create([
    { name: 'Otis', type: 'dog', num_legs: 4 },
    { name: 'Toffee', type: 'cat', num_legs: 4 },
    { name: 'Lyra', type: 'dog', num_legs: 3 }
  ]);

  await xata.db.users.create([
    { full_name: 'A', name: 'A', index: 10, rating: 10.5, settings: { plan: 'paid', dark: true }, pet: pet1.id },
    { full_name: 'B', name: 'B', index: 10, rating: 10.5, settings: { plan: 'free' }, pet: pet2.id },
    { full_name: 'C', name: 'C', index: 30, rating: 40.0, settings: { plan: 'paid' }, pet: pet3.id }
  ]);
});

afterAll(async (ctx) => {
  await hooks.afterAll(ctx);
});

beforeEach(async (ctx) => {
  await hooks.beforeEach(ctx);
});

afterEach(async (ctx) => {
  await hooks.afterEach(ctx);
});

describe('summarize', () => {
  test('group by', async () => {
    const result = await xata.db.users.summarize({
      columns: ['index', 'rating'],
      sort: [{ column: 'index', direction: 'asc' }]
    });

    expect(result.summaries).toMatchInlineSnapshot(`
      [
        {
          "index": 10,
          "rating": 10.5,
        },
        {
          "index": 30,
          "rating": 40,
        },
      ]
    `);

    expect(result.summaries.length).toBeCloseTo(2);
    expect(result.summaries[0].index).toBeCloseTo(10);
    expect(result.summaries[0].rating).toBeCloseTo(10.5);
    expect(result.summaries[1].index).toBeCloseTo(30);
    expect(result.summaries[1].rating).toBeCloseTo(40.0);
  });

  test('group by without any common groups', async () => {
    const result = await xata.db.users.select(['name', 'rating']).sort('name', 'asc').summarize();

    expect(result.summaries).toMatchInlineSnapshot(`
      [
        {
          "name": "A",
          "rating": 10.5,
        },
        {
          "name": "B",
          "rating": 10.5,
        },
        {
          "name": "C",
          "rating": 40,
        },
      ]
    `);

    expect(result.summaries.length).toBeCloseTo(3);
    expect(result.summaries[0].name).toBe('A');
    expect(result.summaries[0].rating).toBeCloseTo(10.5);
    expect(result.summaries[1].name).toBe('B');
    expect(result.summaries[1].rating).toBeCloseTo(10.5);
    expect(result.summaries[2].name).toBe('C');
    expect(result.summaries[2].rating).toBeCloseTo(40.0);
  });

  test('group by with wildcard columns', async () => {
    const result = await xata.db.users
      .select(['settings.*'])
      .sort('settings.plan', 'asc')
      .sort('settings.dark', 'asc')
      .summarize();

    expect(result.summaries).toMatchInlineSnapshot(`
      [
        {
          "settings": {
            "dark": null,
            "labels": null,
            "plan": "free",
          },
        },
        {
          "settings": {
            "dark": true,
            "labels": null,
            "plan": "paid",
          },
        },
        {
          "settings": {
            "dark": null,
            "labels": null,
            "plan": "paid",
          },
        },
      ]
    `);

    expect(result.summaries.length).toBeCloseTo(3);
    expect(result.summaries[0].settings?.plan).toBe('free');
    expect(result.summaries[0].settings?.dark).toBe(null);
    expect(result.summaries[1].settings?.plan).toBe('paid');
    expect(result.summaries[1].settings?.dark).toBe(true);
    expect(result.summaries[2].settings?.plan).toBe('paid');
    expect(result.summaries[2].settings?.dark).toBe(null);
  });

  test('group by with a link', async () => {
    const result = await xata.db.users
      .select(['name', 'settings.plan', 'pet.type', 'pet.num_legs'])
      .summarize({ sort: [{ column: 'name', direction: 'asc' }] });

    expect(result.summaries).toMatchInlineSnapshot(`
      [
        {
          "name": "A",
          "pet": {
            "num_legs": 4,
            "type": "dog",
          },
          "settings": {
            "plan": "paid",
          },
        },
        {
          "name": "B",
          "pet": {
            "num_legs": 4,
            "type": "cat",
          },
          "settings": {
            "plan": "free",
          },
        },
        {
          "name": "C",
          "pet": {
            "num_legs": 3,
            "type": "dog",
          },
          "settings": {
            "plan": "paid",
          },
        },
      ]
    `);

    expect(result.summaries.length).toBeCloseTo(3);
    expect(result.summaries[0].name).toBe('A');
    expect(result.summaries[0].settings?.plan).toBe('paid');
    expect(result.summaries[0].pet?.type).toBe('dog');
    expect(result.summaries[0].pet?.num_legs).toBeCloseTo(4);
    expect(result.summaries[1].name).toBe('B');
    expect(result.summaries[1].settings?.plan).toBe('free');
    expect(result.summaries[1].pet?.type).toBe('cat');
    expect(result.summaries[1].pet?.num_legs).toBeCloseTo(4);
    expect(result.summaries[2].name).toBe('C');
    expect(result.summaries[2].settings?.plan).toBe('paid');
    expect(result.summaries[2].pet?.type).toBe('dog');
    expect(result.summaries[2].pet?.num_legs).toBeCloseTo(3);
  });

  test('count without groups', async () => {
    const result = await xata.db.users.summarize({
      summaries: {
        all: { count: '*' },
        col: { count: 'name' },
        obj_with_null: { count: 'settings.dark' },
        link: { count: 'pet.type' }
      }
    });

    expect(result.summaries).toMatchInlineSnapshot(`
      [
        {
          "all": 3,
          "col": 3,
          "link": 3,
          "obj_with_null": 1,
        },
      ]
    `);

    expect(result.summaries.length).toBeCloseTo(1);
    expect(result.summaries[0].all).toBeCloseTo(3);
    expect(result.summaries[0].col).toBeCloseTo(3);
    expect(result.summaries[0].obj_with_null).toBeCloseTo(1);
    expect(result.summaries[0].link).toBeCloseTo(3);
  });

  test('count with groups', async () => {
    const result = await xata.db.users.select(['index', 'pet.num_legs']).summarize({
      summaries: { nl: { count: 'pet.num_legs' } },
      sort: [{ column: 'index', direction: 'asc' }]
    });

    expect(result.summaries).toMatchInlineSnapshot(`
      [
        {
          "index": 10,
          "nl": 2,
          "pet": {
            "num_legs": 4,
          },
        },
        {
          "index": 30,
          "nl": 1,
          "pet": {
            "num_legs": 3,
          },
        },
      ]
    `);

    expect(result.summaries.length).toBeCloseTo(2);
    expect(result.summaries[0].index).toBeCloseTo(10);
    expect(result.summaries[0].pet?.num_legs).toBeCloseTo(4);
    expect(result.summaries[0].nl).toBeCloseTo(2);
    expect(result.summaries[1].index).toBeCloseTo(30);
    expect(result.summaries[1].pet?.num_legs).toBeCloseTo(3);
    expect(result.summaries[1].nl).toBeCloseTo(1);
  });

  test('count with sort on group', async () => {
    const result = await xata.db.users.select(['index', 'pet.type']).summarize({
      summaries: { nl: { count: 'pet.num_legs' } },
      sort: [
        { column: 'index', direction: 'asc' },
        { column: 'pet.type', direction: 'desc' }
      ]
    });

    expect(result.summaries).toMatchInlineSnapshot(`
      [
        {
          "index": 10,
          "nl": 1,
          "pet": {
            "type": "dog",
          },
        },
        {
          "index": 10,
          "nl": 1,
          "pet": {
            "type": "cat",
          },
        },
        {
          "index": 30,
          "nl": 1,
          "pet": {
            "type": "dog",
          },
        },
      ]
    `);

    expect(result.summaries.length).toBeCloseTo(3);
    expect(result.summaries[0].index).toBeCloseTo(10);
    expect(result.summaries[0].pet?.type).toBe('dog');
    expect(result.summaries[0].nl).toBeCloseTo(1);
    expect(result.summaries[1].index).toBeCloseTo(10);
    expect(result.summaries[1].pet?.type).toBe('cat');
    expect(result.summaries[1].nl).toBeCloseTo(1);
    expect(result.summaries[2].index).toBeCloseTo(30);
    expect(result.summaries[2].pet?.type).toBe('dog');
    expect(result.summaries[2].nl).toBeCloseTo(1);
  });

  test('count with sort on summary', async () => {
    const result = await xata.db.users.select(['index']).summarize({
      summaries: { total: { count: '*' } },
      sort: [{ column: 'total', direction: 'desc' }]
    });

    expect(result.summaries).toMatchInlineSnapshot(`
      [
        {
          "index": 10,
          "total": 2,
        },
        {
          "index": 30,
          "total": 1,
        },
      ]
    `);

    expect(result.summaries.length).toBeCloseTo(2);
    expect(result.summaries[0].index).toBeCloseTo(10);
    expect(result.summaries[0].total).toBeCloseTo(2);
    expect(result.summaries[1].index).toBeCloseTo(30);
    expect(result.summaries[1].total).toBeCloseTo(1);
  });

  test('count with sort on group and count', async () => {
    const result = await xata.db.users.summarize({
      columns: ['pet.name'],
      summaries: { dark_set: { count: 'settings.dark' } },
      sort: [
        { column: 'dark_set', direction: 'desc' },
        { column: 'pet.name', direction: 'asc' }
      ]
    });

    expect(result.summaries).toMatchInlineSnapshot(`
      [
        {
          "dark_set": 1,
          "pet": {
            "name": "Otis",
          },
        },
        {
          "dark_set": 0,
          "pet": {
            "name": "Lyra",
          },
        },
        {
          "dark_set": 0,
          "pet": {
            "name": "Toffee",
          },
        },
      ]
    `);

    expect(result.summaries.length).toBeCloseTo(3);
    expect(result.summaries[0].pet?.name).toBe('Otis');
    expect(result.summaries[0].dark_set).toBeCloseTo(1);
    expect(result.summaries[1].pet?.name).toBe('Lyra');
    expect(result.summaries[1].dark_set).toBeCloseTo(0);
    expect(result.summaries[2].pet?.name).toBe('Toffee');
    expect(result.summaries[2].dark_set).toBeCloseTo(0);
  });

  test('summarize with no results', async () => {
    const result = await xata.db.users.summarize({
      columns: ['name'],
      summaries: { total: { count: '*' } },
      filter: { id: 'nomatches' }
    });

    expect(result.summaries).toMatchInlineSnapshot('[]');

    expect(result.summaries.length).toBeCloseTo(0);
  });

  test('filter on id', async () => {
    const user1 = await xata.db.users.filter({ name: 'A' }).getFirst();

    const result = await xata.db.users.summarize({
      columns: ['name'],
      summaries: { total: { count: '*' } },
      filter: { id: user1?.id ?? '' }
    });

    expect(result.summaries).toMatchInlineSnapshot(`
      [
        {
          "name": "A",
          "total": 1,
        },
      ]
    `);

    expect(result.summaries.length).toBeCloseTo(1);
    expect(result.summaries[0].name).toBe('A');
    expect(result.summaries[0].total).toBeCloseTo(1);
  });

  test('filter should create joins', async () => {
    const result = await xata.db.users.summarize({
      columns: ['name'],
      summaries: { dark_set: { count: 'settings.dark' } },
      sort: [{ dark_set: 'desc' }],
      filter: { 'pet.name': 'Toffee' }
    });

    expect(result.summaries).toMatchInlineSnapshot(`
      [
        {
          "dark_set": 0,
          "name": "B",
        },
      ]
    `);

    expect(result.summaries.length).toBeCloseTo(1);
    expect(result.summaries[0].name).toBe('B');
    expect(result.summaries[0].dark_set).toBeCloseTo(0);
  });

  test('group by, count, sort, filter', async () => {
    const result = await xata.db.users.summarize({
      columns: ['pet.name'],
      summaries: { dark_set: { count: 'settings.dark' } },
      sort: [{ column: 'pet.name', direction: 'asc' }],
      filter: { 'pet.type': 'dog' }
    });

    expect(result.summaries).toMatchInlineSnapshot(`
      [
        {
          "dark_set": 0,
          "pet": {
            "name": "Lyra",
          },
        },
        {
          "dark_set": 1,
          "pet": {
            "name": "Otis",
          },
        },
      ]
    `);

    expect(result.summaries.length).toBeCloseTo(2);
    expect(result.summaries[0].pet?.name).toBe('Lyra');
    expect(result.summaries[0].dark_set).toBeCloseTo(0);
    expect(result.summaries[1].pet?.name).toBe('Otis');
    expect(result.summaries[1].dark_set).toBeCloseTo(1);
  });
});

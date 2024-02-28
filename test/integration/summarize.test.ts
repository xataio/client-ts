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
    {
      full_name: 'A',
      name: 'A',
      index: 10,
      rating: 10.5,
      plan: 'paid',
      dark: true,
      pet: pet1.xata_id,
      account_value: 5
    },
    { full_name: 'B', name: 'B', index: 10, rating: 10.5, plan: 'free', pet: pet2.xata_id, account_value: 3 },
    { full_name: 'C', name: 'C', index: 30, rating: 40.0, plan: 'paid', pet: pet3.xata_id }
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

    expect(result.summaries.length).toBe(2);
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

    expect(result.summaries.length).toBe(3);
    expect(result.summaries[0].name).toBe('A');
    expect(result.summaries[0].rating).toBeCloseTo(10.5);
    expect(result.summaries[1].name).toBe('B');
    expect(result.summaries[1].rating).toBeCloseTo(10.5);
    expect(result.summaries[2].name).toBe('C');
    expect(result.summaries[2].rating).toBeCloseTo(40.0);
  });

  test('group by with wildcard columns', async () => {
    const result = await xata.db.users.select(['plan', 'dark']).sort('plan', 'asc').sort('dark', 'asc').summarize();

    expect(result.summaries).toMatchInlineSnapshot(`
      [
        {
          "dark": null,
          "plan": "free",
        },
        {
          "dark": true,
          "plan": "paid",
        },
        {
          "dark": null,
          "plan": "paid",
        },
      ]
    `);

    expect(result.summaries.length).toBe(3);
    expect(result.summaries[0].plan).toBe('free');
    expect(result.summaries[0].dark).toBe(null);
    expect(result.summaries[1].plan).toBe('paid');
    expect(result.summaries[1].dark).toBe(true);
    expect(result.summaries[2].plan).toBe('paid');
    expect(result.summaries[2].dark).toBe(null);
  });

  test('group by with a link', async () => {
    const result = await xata.db.users
      .select(['name', 'plan', 'pet.type', 'pet.num_legs'])
      .summarize({ sort: [{ column: 'name', direction: 'asc' }] });

    expect(result.summaries).toMatchInlineSnapshot(`
      [
        {
          "name": "A",
          "pet": {
            "num_legs": 4,
            "type": "dog",
          },
          "plan": "paid",
        },
        {
          "name": "B",
          "pet": {
            "num_legs": 4,
            "type": "cat",
          },
          "plan": "free",
        },
        {
          "name": "C",
          "pet": {
            "num_legs": 3,
            "type": "dog",
          },
          "plan": "paid",
        },
      ]
    `);

    expect(result.summaries.length).toBe(3);
    expect(result.summaries[0].name).toBe('A');
    expect(result.summaries[0].plan).toBe('paid');
    expect(result.summaries[0].pet?.type).toBe('dog');
    expect(result.summaries[0].pet?.num_legs).toBeCloseTo(4);
    expect(result.summaries[1].name).toBe('B');
    expect(result.summaries[1].plan).toBe('free');
    expect(result.summaries[1].pet?.type).toBe('cat');
    expect(result.summaries[1].pet?.num_legs).toBeCloseTo(4);
    expect(result.summaries[2].name).toBe('C');
    expect(result.summaries[2].plan).toBe('paid');
    expect(result.summaries[2].pet?.type).toBe('dog');
    expect(result.summaries[2].pet?.num_legs).toBeCloseTo(3);
  });

  test('count without groups', async () => {
    const result = await xata.db.users.summarize({
      summaries: {
        all: { count: '*' },
        col: { count: 'name' },
        obj_with_null: { count: 'dark' },
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

    expect(result.summaries.length).toBe(1);
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

    expect(result.summaries.length).toBe(2);
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

    expect(result.summaries.length).toBe(3);
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

    expect(result.summaries.length).toBe(2);
    expect(result.summaries[0].index).toBeCloseTo(10);
    expect(result.summaries[0].total).toBeCloseTo(2);
    expect(result.summaries[1].index).toBeCloseTo(30);
    expect(result.summaries[1].total).toBeCloseTo(1);
  });

  test('count with sort on group and count', async () => {
    const result = await xata.db.users.summarize({
      columns: ['pet.name'],
      summaries: { dark_set: { count: 'dark' } },
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

    expect(result.summaries.length).toBe(3);
    expect(result.summaries[0].pet?.name).toBe('Otis');
    expect(result.summaries[0].dark_set).toBeCloseTo(1);
    expect(result.summaries[1].pet?.name).toBe('Lyra');
    expect(result.summaries[1].dark_set).toBeCloseTo(0);
    expect(result.summaries[2].pet?.name).toBe('Toffee');
    expect(result.summaries[2].dark_set).toBeCloseTo(0);
  });

  test('sort asc puts nulls last', async () => {
    const result = await xata.db.users.select(['name']).summarize({
      summaries: { total_account_value: { sum: 'account_value' } },
      sort: [{ column: 'total_account_value', direction: 'asc' }]
    });

    expect(result.summaries).toMatchInlineSnapshot(`
      [
        {
          "name": "B",
          "total_account_value": 3,
        },
        {
          "name": "A",
          "total_account_value": 5,
        },
        {
          "name": "C",
          "total_account_value": null,
        },
      ]
    `);

    expect(result.summaries.length).toBe(3);
    expect(result.summaries[0].name).toBe('B');
    expect(result.summaries[0].total_account_value).toBeCloseTo(3);
    expect(result.summaries[1].name).toBe('A');
    expect(result.summaries[1].total_account_value).toBeCloseTo(5);
    expect(result.summaries[2].name).toBe('C');
    expect(result.summaries[2].total_account_value).toBeNull();
  });

  test('sort desc puts nulls last', async () => {
    const result = await xata.db.users.select(['name']).summarize({
      summaries: { total_account_value: { sum: 'account_value' } },
      sort: [{ column: 'total_account_value', direction: 'desc' }]
    });

    expect(result.summaries).toMatchInlineSnapshot(`
      [
        {
          "name": "A",
          "total_account_value": 5,
        },
        {
          "name": "B",
          "total_account_value": 3,
        },
        {
          "name": "C",
          "total_account_value": null,
        },
      ]
    `);

    expect(result.summaries.length).toBe(3);
    expect(result.summaries[0].name).toBe('A');
    expect(result.summaries[0].total_account_value).toBeCloseTo(5);
    expect(result.summaries[1].name).toBe('B');
    expect(result.summaries[1].total_account_value).toBeCloseTo(3);
    expect(result.summaries[2].name).toBe('C');
    expect(result.summaries[2].total_account_value).toBeNull();
  });

  test('summarize with no results', async () => {
    const result = await xata.db.users.summarize({
      columns: ['name'],
      summaries: { total: { count: '*' } },
      filter: { xata_id: 'nomatches' }
    });

    expect(result.summaries).toMatchInlineSnapshot('[]');

    expect(result.summaries.length).toBe(0);
  });

  test('filter on id', async () => {
    const user1 = await xata.db.users.filter({ name: 'A' }).getFirst();

    const result = await xata.db.users.summarize({
      columns: ['name'],
      summaries: { total: { count: '*' } },
      filter: { xata_id: user1?.xata_id ?? '' }
    });

    expect(result.summaries).toMatchInlineSnapshot(`
      [
        {
          "name": "A",
          "total": 1,
        },
      ]
    `);

    expect(result.summaries.length).toBe(1);
    expect(result.summaries[0].name).toBe('A');
    expect(result.summaries[0].total).toBeCloseTo(1);
  });

  test('filter should create joins', async () => {
    const result = await xata.db.users.summarize({
      columns: ['name'],
      summaries: { dark_set: { count: 'dark' } },
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

    expect(result.summaries.length).toBe(1);
    expect(result.summaries[0].name).toBe('B');
    expect(result.summaries[0].dark_set).toBeCloseTo(0);
  });

  test('filter, group by, count, min, max, average, sum, sort, summariesFilter', async () => {
    const result = await xata.db.users.summarize({
      columns: ['pet.name'],
      summaries: {
        dark_set: { count: 'dark' },
        min_legs: { min: 'pet.num_legs' },
        max_legs: { max: 'pet.num_legs' },
        sum_index: { sum: 'index' },
        avg_rating: { average: 'rating' }
      },
      sort: [{ column: 'pet.name', direction: 'asc' }],
      filter: { 'pet.type': 'dog' },
      summariesFilter: {
        dark_set: { $ge: 1 },
        min_legs: { $ge: 4 },
        max_legs: { $le: 10 },
        sum_index: 10,
        avg_rating: 10.5
      }
    });

    expect(result.summaries).toMatchInlineSnapshot(`
      [
        {
          "avg_rating": 10.5,
          "dark_set": 1,
          "max_legs": 4,
          "min_legs": 4,
          "pet": {
            "name": "Otis",
          },
          "sum_index": 10,
        },
      ]
    `);

    expect(result.summaries.length).toBe(1);
    expect(result.summaries[0].pet?.name).toBe('Otis');
    expect(result.summaries[0].dark_set).toBeCloseTo(1);
    expect(result.summaries[0].min_legs).toBeCloseTo(4);
    expect(result.summaries[0].max_legs).toBeCloseTo(4);
    expect(result.summaries[0].sum_index).toBeCloseTo(10);
    expect(result.summaries[0].avg_rating).toBeCloseTo(10.5);
  });

  test('all aggregates', async () => {
    const result = await xata.db.users.summarize({
      columns: ['pet.type'],
      summaries: {
        // count
        test_count_all: { count: '*' },
        test_count: { count: 'dark' },
        test_count_linked: { count: 'pet.num_legs' },
        // min
        test_min_int: { min: 'pet.num_legs' },
        test_min_float: { min: 'rating' },
        // max
        test_max_int: { max: 'pet.num_legs' },
        test_max_float: { max: 'rating' },
        // sum
        test_sum_int: { sum: 'pet.num_legs' },
        test_sum_float: { sum: 'rating' },
        // avg
        test_avg_int: { average: 'pet.num_legs' },
        test_avg_float: { average: 'rating' }
      },
      sort: [{ column: 'pet.type', direction: 'asc' }]
    });

    expect(result.summaries).toMatchInlineSnapshot(`
      [
        {
          "pet": {
            "type": "cat",
          },
          "test_avg_float": 10.5,
          "test_avg_int": 4,
          "test_count": 0,
          "test_count_all": 1,
          "test_count_linked": 1,
          "test_max_float": 10.5,
          "test_max_int": 4,
          "test_min_float": 10.5,
          "test_min_int": 4,
          "test_sum_float": 10.5,
          "test_sum_int": 4,
        },
        {
          "pet": {
            "type": "dog",
          },
          "test_avg_float": 25.25,
          "test_avg_int": 3.5,
          "test_count": 1,
          "test_count_all": 2,
          "test_count_linked": 2,
          "test_max_float": 40,
          "test_max_int": 4,
          "test_min_float": 10.5,
          "test_min_int": 3,
          "test_sum_float": 50.5,
          "test_sum_int": 7,
        },
      ]
    `);

    expect(result.summaries.length).toBe(2);
    expect(result.summaries[0].pet?.type).toBe('cat');
    expect(result.summaries[0].test_count_all).toBeCloseTo(1);
    expect(result.summaries[0].test_count).toBeCloseTo(0);
    expect(result.summaries[0].test_count_linked).toBeCloseTo(1);
    expect(result.summaries[0].test_min_int).toBeCloseTo(4);
    expect(result.summaries[0].test_min_float).toBeCloseTo(10.5);
    expect(result.summaries[0].test_max_int).toBeCloseTo(4);
    expect(result.summaries[0].test_max_float).toBeCloseTo(10.5);
    expect(result.summaries[0].test_sum_int).toBeCloseTo(4);
    expect(result.summaries[0].test_sum_float).toBeCloseTo(10.5);
    expect(result.summaries[0].test_avg_int).toBeCloseTo(4);
    expect(result.summaries[0].test_avg_float).toBeCloseTo(10.5);

    expect(result.summaries[1].pet?.type).toBe('dog');
    expect(result.summaries[1].test_count_all).toBeCloseTo(2);
    expect(result.summaries[1].test_count).toBeCloseTo(1);
    expect(result.summaries[1].test_count_linked).toBeCloseTo(2);
    expect(result.summaries[1].test_min_int).toBeCloseTo(3);
    expect(result.summaries[1].test_min_float).toBeCloseTo(10.5);
    expect(result.summaries[1].test_max_int).toBeCloseTo(4);
    expect(result.summaries[1].test_max_float).toBeCloseTo(40);
    expect(result.summaries[1].test_sum_int).toBeCloseTo(7);
    expect(result.summaries[1].test_sum_float).toBeCloseTo(50.5);
    expect(result.summaries[1].test_avg_int).toBeCloseTo(3.5);
    expect(result.summaries[1].test_avg_float).toBeCloseTo(25.25);
  });

  test('summariesFilter with min', async () => {
    const result = await xata.db.users.summarize({
      columns: ['pet.name', 'pet.type'],
      summaries: {
        min_rating: { min: 'rating' }
      },
      summariesFilter: {
        min_rating: { $gt: 10.6 }
      }
    });

    expect(result.summaries).toMatchInlineSnapshot(`
      [
        {
          "min_rating": 40,
          "pet": {
            "name": "Lyra",
            "type": "dog",
          },
        },
      ]
    `);

    expect(result.summaries.length).toBe(1);
    expect(result.summaries[0].pet?.name).toBe('Lyra');
    expect(result.summaries[0].pet?.type).toBe('dog');
    expect(result.summaries[0].min_rating).toBeCloseTo(40);
  });

  test('summariesFilter with max', async () => {
    const result = await xata.db.users.summarize({
      columns: ['pet.name', 'pet.type'],
      summaries: {
        max_rating: { max: 'rating' }
      },
      summariesFilter: {
        max_rating: { $le: 10.5 }
      },
      sort: ['pet.name']
    });

    expect(result.summaries).toMatchInlineSnapshot(`
      [
        {
          "max_rating": 10.5,
          "pet": {
            "name": "Otis",
            "type": "dog",
          },
        },
        {
          "max_rating": 10.5,
          "pet": {
            "name": "Toffee",
            "type": "cat",
          },
        },
      ]
    `);

    expect(result.summaries.length).toBe(2);
    expect(result.summaries[0].pet?.name).toBe('Otis');
    expect(result.summaries[0].pet?.type).toBe('dog');
    expect(result.summaries[0].max_rating).toBeCloseTo(10.5);
    expect(result.summaries[1].pet?.name).toBe('Toffee');
    expect(result.summaries[1].pet?.type).toBe('cat');
    expect(result.summaries[1].max_rating).toBeCloseTo(10.5);
  });

  test('summariesFilter with sum', async () => {
    const result = await xata.db.users.summarize({
      columns: ['pet.name', 'pet.type'],
      summaries: {
        sum_rating: { sum: 'rating' }
      },
      summariesFilter: {
        sum_rating: { $gt: 10.5 }
      }
    });

    expect(result.summaries).toMatchInlineSnapshot(`
      [
        {
          "pet": {
            "name": "Lyra",
            "type": "dog",
          },
          "sum_rating": 40,
        },
      ]
    `);

    expect(result.summaries.length).toBe(1);
    expect(result.summaries[0].pet?.name).toBe('Lyra');
    expect(result.summaries[0].pet?.type).toBe('dog');
    expect(result.summaries[0].sum_rating).toBeCloseTo(40);
  });

  test('summariesFilter with avg', async () => {
    const result = await xata.db.users.summarize({
      columns: ['pet.name', 'pet.type'],
      summaries: {
        avg_rating: { average: 'rating' }
      },
      summariesFilter: {
        avg_rating: { $gt: 10.5 }
      }
    });

    expect(result.summaries).toMatchInlineSnapshot(`
      [
        {
          "avg_rating": 40,
          "pet": {
            "name": "Lyra",
            "type": "dog",
          },
        },
      ]
    `);

    expect(result.summaries.length).toBe(1);
    expect(result.summaries[0].pet?.name).toBe('Lyra');
    expect(result.summaries[0].pet?.type).toBe('dog');
    expect(result.summaries[0].avg_rating).toBeCloseTo(40);
  });

  test('filter, columns, summaries, complex summariesFilter', async () => {
    const result = await xata.db.users.summarize({
      columns: ['pet.type'],
      filter: {
        $any: [{ 'pet.type': 'dog' }, { 'pet.type': 'cat' }]
      },
      summaries: {
        total: { count: '*' },
        max_num_legs: { max: 'pet.num_legs' },
        average_rating: { average: 'rating' }
      },
      summariesFilter: {
        $any: [
          {
            'pet.type': 'dog',
            $any: [{ max_num_legs: { $ge: 4 }, total: 2 }, { average_rating: { $ge: 10.0 } }]
          },
          {
            $any: [
              { 'pet.type': 'cat', total: 2, max_num_legs: { $gt: 4 } },
              { 'pet.type': 'cat', average_rating: 10.5 }
            ]
          }
        ]
      }
    });

    expect(result.summaries).toMatchInlineSnapshot(`
      [
        {
          "average_rating": 10.5,
          "max_num_legs": 4,
          "pet": {
            "type": "cat",
          },
          "total": 1,
        },
        {
          "average_rating": 25.25,
          "max_num_legs": 4,
          "pet": {
            "type": "dog",
          },
          "total": 2,
        },
      ]
    `);

    expect(result.summaries.length).toBe(2);
    expect(result.summaries[0].pet?.type).toBe('cat');
    expect(result.summaries[0].total).toBeCloseTo(1);
    expect(result.summaries[0].max_num_legs).toBeCloseTo(4);
    expect(result.summaries[0].average_rating).toBeCloseTo(10.5);
    expect(result.summaries[1].pet?.type).toBe('dog');
    expect(result.summaries[1].total).toBeCloseTo(2);
    expect(result.summaries[1].max_num_legs).toBeCloseTo(4);
    expect(result.summaries[1].average_rating).toBeCloseTo(25.25);
  });
});

/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, expect, test } from 'vitest';
import { Filter, cleanFilter } from './filters';
import { XataRecord } from './record';
import { FilterExpression } from '../api/schemas';
import { parseFilter } from './parsing';

type Record = XataRecord & {
  xata_id: string;
  xata_version: number;
  xata_createdat: Date;
  xata_updatedat: Date;
  name: string;
  string: string;
  number: number;
  boolean: boolean;
  test: string;
  labels?: string[];
  age: number;
  plan: string;
  dark: boolean;
};

// Single column with implicit is
const singleColumnWithImplicitIs: Filter<Record> = { name: 'r2' };

// Single column with explicit is
const singleColumnWithExplicitIs: Filter<Record> = { name: { $is: 'r2' } };

// Is string
const isString: Filter<Record> = { string: 'string' };

// Is true
const isTrue: Filter<Record> = { boolean: true };

// Is false
const isFalse: Filter<Record> = { boolean: false };

// Is pos int
const isPosInt: Filter<Record> = { number: 1234567 };

// Is neg int
const isNegInt: Filter<Record> = { number: -42 };

// Is float
const isFloat: Filter<Record> = { number: 3.14 };

// Or with $any
const orWithAny: Filter<Record> = { plan: { $any: ['free', 'paid'] } };

// Multiple columns implicit and
const multipleColumnsImplicitAnd: Filter<Record> = { dark: true, plan: 'free' };

// Explicit $all with multi-key filter list
const explicitAllWithMultiKeyFilterList: Filter<Record> = {
  $all: { dark: true, plan: 'free' }
};

// Explicit $all with filter list
const explicitAllWithFilterList: Filter<Record> = {
  $all: [{ dark: true }, { plan: 'free' }]
};

// Explicit $any with multi-key filter list
const explicitAnyWithMultiKeyFilterList: Filter<Record> = {
  $all: { dark: true, plan: 'free' }
};

// Explicit $any with filter list
const explicitAnyWithFilterList: Filter<Record> = {
  $any: [{ dark: true }, { plan: 'free' }]
};

// $any with multiple values
const anyWithMultipleValues: Filter<Record> = { number: { $any: [1, 2, 3] } };

// $none with multiple values
const noneWithMultipleValues: Filter<Record> = { number: { $none: [1, 2, 3] } };

// Exists filter
const existsFilter: Filter<Record> = { $exists: 'test' };

// Not exists filter
const notExistsFilter: Filter<Record> = { $notExists: 'test' };

// Exists with all
const existsWithAll: Filter<Record> = { $all: [{ $exists: 'test' }, { $exists: 'name' }] };

// Nest any with not
const nestAnyWithNot: Filter<Record> = { $not: { $any: { dark: true, plan: 'free' } } };

// Mix $all and $any with extra keys
const mixAllAndAnyWithExtraKeys: Filter<Record> = {
  $all: { $any: { dark: false, plan: 'free' }, name: 'r1' }
};

// Range query with less first
const rangeQueryWithLessFirst: Filter<Record> = { age: { $lt: 30, $ge: 20 } };

// Range query with greater first
const rangeQueryWithGreaterFirst: Filter<Record> = { age: { $ge: 20, $lt: 30 } };

// Ordered op
const orderedOp: Filter<Record> = { age: { $lt: 30 } };

// Simple includes
const simpleIncludes: Filter<Record> = { labels: { $includes: 'test' } };

// Simple includes with op
const simpleIncludesWithOp: Filter<Record> = { labels: { $includes: { $contains: 'test' } } };

// Simple includes multiple
const simpleIncludesMultiple: Filter<Record> = { labels: { $includes: ['a', 'b', 'c'] } };

// Simple includes multiple with op
const simpleIncludesMultipleWithOp: Filter<Record> = {
  labels: { $includes: [{ $is: 'a' }, { $is: 'b' }, { $is: 'c' }] }
};

// Includes with many comparisons
const includesWithManyComparisons: Filter<Record> = {
  labels: { $includes: { $all: [{ $contains: 'a' }, { $contains: 'b' }] } }
};

// Simple includes multiple op and value
const simpleIncludesMultipleOpAndValue: Filter<Record> = { labels: { $includes: [{ $contains: 'a' }, 'b'] } };

// Includes with mode and array of filters
const includesWithModeAndArrayOfFilters: Filter<Record> = {
  labels: { $includesNone: [{ $contains: 'test' }, 'abc', { $endsWith: 'bad' }] }
};

// Includes with mix of any and all in predicate position
const includesWithMixOfAnyAndAllInPredicatePosition: Filter<Record> = {
  labels: { $includes: { $any: { $all: [{ $startsWith: 'test' }, { $contains: 'x' }], $any: ['a', 'b'] } } }
};

// TODO get rid of these??
// // Simple $includesany
// const simpleIncludesAny: Filter<Record> = { labels: { $includesAny: 'test' } };

// // Simple $includesall
// const simpleIncludesAll: Filter<Record> = { labels: { $includesAll: 'test' } };

// // Simple $includesnone
// const simpleIncludesNone: Filter<Record> = { labels: { $includesNone: 'test' } };

// Exists value must be string not int
// @ts-expect-error
const existsValueMustBeStringNotInt: Filter<Record> = { $exists: 42 };

// Filter by one column
const filterByOneColumn: Filter<Record> = { name: 'r1' };

// Filter with the $is operator
const filterWithTheIsOperator: Filter<Record> = { name: { $is: 'r1' } };

// Filter with $any operation
const filterWithAnyOperation: Filter<Record> = { plan: { $any: ['free', 'paid'] } };

// Filter with and operations
const filterWithAndOperations: Filter<Record> = { dark: true, plan: 'free' };

// Filter with both and and any operations
const filterWithBothAndAndAnyOperations: Filter<Record> = {
  $any: { dark: true, plan: 'free' }
};

// Filter with both and and any operations in array
const filterWithBothAndAndAnyOperationsInArray: Filter<Record> = { $any: [{ name: 'r1' }, { name: 'r2' }] };

// Filter with exists operation
const filterWithExistsOperation: Filter<Record> = { $exists: 'dark' };

// Filter with exists, and and any operations
const filterWithExistsAndAndAnyOperations: Filter<Record> = {
  $all: [{ $exists: 'dark' }, { $exists: 'name' }]
};

// Filter with not exists operation
const filterWithNotExistsOperation: Filter<Record> = { $notExists: 'plan' };

// Filter with partial match
const filterWithPartialMatch: Filter<Record> = { name: { $contains: 'value' } };

// Filter with pattern operator
const filterWithPatternOperator: Filter<Record> = { name: { $pattern: 'value' } };

// Filter with iPatter operator
const filterWithIPatterOperator: Filter<Record> = { name: { $iPattern: 'value' } };

// Filter with $startsWith and $endsWith operators
const filterWithStartsWithAndEndsWithOperators: Filter<Record> = {
  name: { $startsWith: 'value', $endsWith: 'value' }
};

// Filter with numeric ranges
const filterWithNumericRanges: Filter<Record> = { age: { $lt: 30, $ge: 20 } };

// Filter with negations
const filterWithNegations: Filter<Record> = { $not: { name: 'r1' } };

// Filter with complex negations
const filterWithComplexNegations: Filter<Record> = { $not: { $any: [{ name: 'r1' }, { name: 'r2' }] } };

// Filter with arrays complex negations
const filterWithArraysComplexNegations: Filter<Record> = {
  labels: {
    $includes: {
      $all: [{ $contains: 'label' }, { $not: { $endsWith: '-debug' } }]
    }
  }
};

// TODO remove includesAll?
// Filters with $includesAll
// const filtersWithIncludesAll: Filter<Record> = {
//   labels: {
//     $includesAll: [{ $contains: 'label' }]
//   }
// };

// Filter with invalid property type
// @ts-expect-error
const filterWithInvalidPropertyType: Filter<Record> = { name: 42 };

// Filter with invalid property $is type
// @ts-expect-error
const filterWithInvalidOperator: Filter<Record> = { name: { $is: 42 } };

// Filter with wildcard is not allowed
// @ts-expect-error
// const filterWithWildcardIsNotAllowed: Filter<Record> = { '*': { $is: 'foo' } };

// // Filter with link wildcard is not allowed
// // @ts-expect-error
// const filterWithLinkWildcardIsNotAllowed: Filter<Record> = { 'owner.*': { $is: 'foo' } };

// Filter on internal column is allowed
const filterOnInternalColumnIsAllowed: Filter<Record> = { xata_version: { $is: 4 } };

describe('parseFilter', () => {
  test('singleColumnWithImplicitIs', () => {
    const filter: Filter<Record> = { name: 'r2' };
    expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [
          {
            "field": "name",
            "operator": "=",
            "value": "r2",
          },
        ],
        "NOT": [],
        "OR": [],
      }
    `);
  });
  test('should remove empty objects', () => {
    const filter: Filter<Record> = { name: { $is: 'r2' } };
    expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [
          {
            "field": "name",
            "operator": "=",
            "value": "r2",
          },
        ],
        "NOT": [],
        "OR": [],
      }
    `);
  });
  test('should remove empty objects', () => {
    const filter: Filter<Record> = { string: 'string' };

    expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [
          {
            "field": "string",
            "operator": "=",
            "value": "string",
          },
        ],
        "NOT": [],
        "OR": [],
      }
    `);
  });
  test('should remove empty objects', () => {
    const filter: Filter<Record> = { boolean: true };

    expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [
          {
            "field": "boolean",
            "operator": "=",
            "value": true,
          },
        ],
        "NOT": [],
        "OR": [],
      }
    `);
  });
  test('should remove empty objects', () => {
    const filter: Filter<Record> = { boolean: false };

    expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [
          {
            "field": "boolean",
            "operator": "=",
            "value": false,
          },
        ],
        "NOT": [],
        "OR": [],
      }
    `);
  });
  test('should remove empty objects', () => {
    const filter: Filter<Record> = { number: 1234567 };

    expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [
          {
            "field": "number",
            "operator": "=",
            "value": 1234567,
          },
        ],
        "NOT": [],
        "OR": [],
      }
    `);
  });
  test('should remove empty objects', () => {
    const filter: Filter<Record> = { number: -42 };

    expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [
          {
            "field": "number",
            "operator": "=",
            "value": -42,
          },
        ],
        "NOT": [],
        "OR": [],
      }
    `);
  });
  test('should remove empty objects', () => {
    const filter: Filter<Record> = { number: 3.14 };

    expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [
          {
            "field": "number",
            "operator": "=",
            "value": 3.14,
          },
        ],
        "NOT": [],
        "OR": [],
      }
    `);
  });
  test('should remove empty objects', () => {
    const filter: Filter<Record> = { plan: { $any: ['free', 'paid'] } };

    expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [],
        "NOT": [],
        "OR": [
          {
            "field": "plan",
            "operator": "=",
            "value": "free",
          },
          {
            "field": "plan",
            "operator": "=",
            "value": "paid",
          },
        ],
      }
    `);
  });
  test('should remove empty objects', () => {
    const filter: Filter<Record> = { dark: true, plan: 'free' };

    expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [
          {
            "field": "dark",
            "operator": "=",
            "value": true,
          },
          {
            "field": "plan",
            "operator": "=",
            "value": "free",
          },
        ],
        "NOT": [],
        "OR": [],
      }
    `);
  });
  test('should remove empty objects', () => {
    const filter: Filter<Record> = {
      $all: { dark: true, plan: 'free' }
    };

    expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [
          {
            "field": "dark",
            "operator": "=",
            "value": true,
          },
          {
            "field": "plan",
            "operator": "=",
            "value": "free",
          },
        ],
        "NOT": [],
        "OR": [],
      }
    `);
  });
  test('explicitAnyWithFilterList', () => {
    const filter: Filter<Record> = { $all: [{ dark: true }, { plan: 'free' }] };
    expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [
          {
            "field": "dark",
            "operator": "=",
            "value": true,
          },
          {
            "field": "plan",
            "operator": "=",
            "value": "free",
          },
        ],
        "NOT": [],
        "OR": [],
      }
    `);
  });
  test('anyWithMultipleValues', () => {
    // const filter: Filter<Record> = { name: { $is: 'r2' } };
    const filter: Filter<Record> = { number: { $any: [1, 2, 3] } };
    expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [],
        "NOT": [],
        "OR": [
          {
            "field": "number",
            "operator": "=",
            "value": 1,
          },
          {
            "field": "number",
            "operator": "=",
            "value": 2,
          },
          {
            "field": "number",
            "operator": "=",
            "value": 3,
          },
        ],
      }
    `);
  });
  test('noneWithMultipleValues', () => {
    // const filter: Filter<Record> = { name: { $is: 'r2' } };
    const filter: Filter<Record> = { number: { $none: [1, 2, 3] } };
    expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [],
        "NOT": [
          {
            "field": "number",
            "operator": "=",
            "value": 1,
          },
          {
            "field": "number",
            "operator": "=",
            "value": 2,
          },
          {
            "field": "number",
            "operator": "=",
            "value": 3,
          },
        ],
        "OR": [],
      }
    `);
  });
  test('existsFilter', () => {
    // const filter: Filter<Record> = { name: { $is: 'r2' } };
    const filter: Filter<Record> = { $exists: 'test' };
    expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [
          {
            "field": "test",
            "operator": "exists",
            "value": "test",
          },
        ],
        "NOT": [],
        "OR": [],
      }
    `);
  });
  test('notExistsFilter', () => {
    // const filter: Filter<Record> = { name: { $is: 'r2' } };
    const filter: Filter<Record> = { $notExists: 'test' };
    expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [
          {
            "field": "test",
            "operator": "not exists",
            "value": "test",
          },
        ],
        "NOT": [],
        "OR": [],
      }
    `);
  });
  test('existsWithAll', () => {
    const filter: Filter<Record> = { $all: [{ $exists: 'test' }, { $exists: 'name' }] };
    expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [
          {
            "field": "test",
            "operator": "exists",
            "value": "test",
          },
          {
            "field": "name",
            "operator": "exists",
            "value": "name",
          },
        ],
        "NOT": [],
        "OR": [],
      }
    `);
  });
  test.skip('nestAnyWithNot', () => {
    const filter: Filter<Record> = { $not: { $any: { dark: true, plan: 'free' } } };
    expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [],
        "NOT": [
          {
            "OR": [
              {
                "field": "dark",
                "operator": "=",
                "value": true,
              },
              {
                "field": "plan",
                "operator": "=",
                "value": "free",
              },
            ]
          }
        ],
        "OR": [],
      }
    `);
  });
  test.skip('mixAllAndAnyWithExtraKeys', () => {
    const filter: Filter<Record> = {
      $all: { $any: { dark: false, plan: 'free' }, name: 'r1' }
    };

    expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [
          {
            "field": "name",
            "operator": "=",
            "value": "r1",
          },
        ],
        "NOT": [],
        "OR": [
          {
            "field": "dark",
            "operator": "=",
            "value": false,
          },
          {
            "field": "plan",
            "operator": "=",
            "value": "free",
          },
        ],
      }
    `);
  });
  test('rangeQueryWithLessFirst', () => {
    const filter: Filter<Record> = { age: { $lt: 30, $ge: 20 } };

    expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [
          {
            "field": "age",
            "operator": "<",
            "value": 30,
          },
          {
            "field": "age",
            "operator": "=",
            "value": 20,
          },
        ],
        "NOT": [],
        "OR": [],
      }
    `);
  });
  test('rangeQueryWithGreaterFirst', () => {
    const filter: Filter<Record> = { age: { $ge: 20, $lt: 30 } };

    expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [
          {
            "field": "age",
            "operator": "=",
            "value": 20,
          },
          {
            "field": "age",
            "operator": "<",
            "value": 30,
          },
        ],
        "NOT": [],
        "OR": [],
      }
    `);
  });
  test('orderedOp', () => {
    const filter: Filter<Record> = { age: { $lt: 30 } };

    expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [
          {
            "field": "age",
            "operator": "<",
            "value": 30,
          },
        ],
        "NOT": [],
        "OR": [],
      }
    `);
  });
  test('simpleIncludes', () => {
    const filter: Filter<Record> = { labels: { $includes: 'test' } };

    expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [
          {
            "field": "labels",
            "operator": "in",
            "value": "test",
          },
        ],
        "NOT": [],
        "OR": [],
      }
    `);
  });
  // TODO not sure?
  test('simpleIncludesWithOp', () => {
    const filter: Filter<Record> = { labels: { $includes: { $contains: 'test' } } };

    expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [
          {
            "field": "labels",
            "operator": "like",
            "value": "test",
          },
        ],
        "NOT": [],
        "OR": [],
      }
    `);
  });
  test('simpleIncludesMultiple', () => {
    const filter: Filter<Record> = { labels: { $includes: ['a', 'b', 'c'] } };

    expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [
          {
            "field": "labels",
            "operator": "=",
            "value": "a",
          },
          {
            "field": "labels",
            "operator": "=",
            "value": "b",
          },
          {
            "field": "labels",
            "operator": "=",
            "value": "c",
          },
        ],
        "NOT": [],
        "OR": [],
      }
    `);
  });
  test('simpleIncludesMultipleWithOp', () => {
    const filter: Filter<Record> = {
      labels: { $includes: [{ $is: 'a' }, { $is: 'b' }, { $is: 'c' }] }
    };

    expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [
          {
            "field": "labels",
            "operator": "=",
            "value": "a",
          },
          {
            "field": "labels",
            "operator": "=",
            "value": "b",
          },
          {
            "field": "labels",
            "operator": "=",
            "value": "c",
          },
        ],
        "NOT": [],
        "OR": [],
      }
    `);
  });
  test('includesWithManyComparisons', () => {
    const filter: Filter<Record> = {
      labels: { $includes: { $all: [{ $contains: 'a' }, { $contains: 'b' }] } }
    };
    expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [
          {
            "field": "labels",
            "operator": "like",
            "value": "a",
          },
          {
            "field": "labels",
            "operator": "like",
            "value": "b",
          },
        ],
        "NOT": [],
        "OR": [],
      }
    `);
  });
  // TODO is this correct?
  test('simpleIncludesMultipleOpAndValue', () => {
    const filter: Filter<Record> = { labels: { $includes: [{ $contains: 'a' }, 'b'] } };

    expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [
          {
            "field": "labels",
            "operator": "like",
            "value": "a",
          },
          {
            "field": "labels",
            "operator": "=",
            "value": "b",
          },
        ],
        "NOT": [],
        "OR": [],
      }
    `);
  });
  // TODO fix this.
  test('includesWithModeAndArrayOfFilters', () => {
    const filter: Filter<Record> = {
      labels: { $includesNone: [{ $contains: 'test' }, 'abc', { $endsWith: 'bad' }] }
    };

    expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [
          {
            "field": "labels",
            "operator": "like",
            "value": "test",
          },
          {
            "field": "labels",
            "operator": "=",
            "value": "abc",
          },
          {
            "field": "labels",
            "operator": "=",
            "value": "bad",
          },
        ],
        "NOT": [],
        "OR": [],
      }
    `);
  });
});
// TODO correct this
test('includesWithModeAndArrayOfFilters', () => {
  const filter: Filter<Record> = {
    labels: { $includesNone: [{ $contains: 'test' }, 'abc', { $endsWith: 'bad' }] }
  };

  expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [
          {
            "field": "labels",
            "operator": "like",
            "value": "test",
          },
          {
            "field": "labels",
            "operator": "=",
            "value": "abc",
          },
          {
            "field": "labels",
            "operator": "=",
            "value": "bad",
          },
        ],
        "NOT": [],
        "OR": [],
      }
    `);
});

// TODO fix
test('includesWithMixOfAnyAndAllInPredicatePosition', () => {
  const filter: Filter<Record> = {
    labels: { $includes: { $any: { $all: [{ $startsWith: 'test' }, { $contains: 'x' }], $any: ['a', 'b'] } } }
  };

  expect(parseFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "AND": [
          {
            "field": "labels",
            "operator": "=",
            "value": "test",
          },
          {
            "field": "labels",
            "operator": "like",
            "value": "x",
          },
        ],
        "NOT": [],
        "OR": [
          {
            "field": "labels",
            "operator": "=",
            "value": "a",
          },
          {
            "field": "labels",
            "operator": "=",
            "value": "b",
          },
        ],
      }
    `);
});

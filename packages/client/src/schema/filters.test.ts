/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, expect, test } from 'vitest';
import { Filter, cleanFilter } from './filters';
import { XataRecord } from './record';
import { FilterExpression } from '../api/schemas';

type Record = XataRecord & {
  name: string;
  string: string;
  number: number;
  boolean: boolean;
  test: string;
  labels?: string[];
  age: number;
  settings: {
    plan: string;
    dark: boolean;
    labels?: string[];
  };
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

//  with dots
const withDots: Filter<Record> = { 'settings.plan': 'free' };

// Nested columns
const nestedColumns: Filter<Record> = { settings: { plan: 'free' } };

// Nested columns array
const nestedColumnsArray: Filter<Record> = { settings: [{ dark: false }, { plan: 'free' }] };

// Nested columns any
const nestedColumnsAny: Filter<Record> = { settings: { $any: [{ plan: 'free' }, { plan: 'trial' }] } };

// Nested columns any value
const nestedColumnsAnyValue: Filter<Record> = { settings: { plan: { $any: ['free', 'trial'] } } };

// Or with $any
const orWithAny: Filter<Record> = { 'settings.plan': { $any: ['free', 'paid'] } };

// Multiple columns implicit and
const multipleColumnsImplicitAnd: Filter<Record> = { 'settings.dark': true, 'settings.plan': 'free' };

// Explicit $all with multi-key filter list
const explicitAllWithMultiKeyFilterList: Filter<Record> = {
  $all: { 'settings.dark': true, 'settings.plan': 'free' }
};

// Explicit $all with filter list
const explicitAllWithFilterList: Filter<Record> = {
  $all: [{ 'settings.dark': true }, { 'settings.plan': 'free' }]
};

// Explicit $any with multi-key filter list
const explicitAnyWithMultiKeyFilterList: Filter<Record> = {
  $all: { 'settings.dark': true, 'settings.plan': 'free' }
};

// Explicit $any with filter list
const explicitAnyWithFilterList: Filter<Record> = {
  $any: [{ 'settings.dark': true }, { 'settings.plan': 'free' }]
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
const existsWithAll: Filter<Record> = { $all: [{ $exists: 'settings' }, { $exists: 'name' }] };

// Nest any with not
const nestAnyWithNot: Filter<Record> = { $not: { $any: { 'settings.dark': true, 'settings.plan': 'free' } } };

// Mix $all and $any with extra keys
const mixAllAndAnyWithExtraKeys: Filter<Record> = {
  $all: { $any: { 'settings.dark': false, 'settings.plan': 'free' }, name: 'r1' }
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

// Simple $includesany
const simpleIncludesAny: Filter<Record> = { labels: { $includesAny: 'test' } };

// Simple $includesall
const simpleIncludesAll: Filter<Record> = { labels: { $includesAll: 'test' } };

// Simple $includesnone
const simpleIncludesNone: Filter<Record> = { labels: { $includesNone: 'test' } };

// Exists value must be string not int
// @ts-expect-error
const existsValueMustBeStringNotInt: Filter<Record> = { $exists: 42 };

// Exists value must be string not objct
// @ts-expect-error
const existsValueMustBeStringNotObject: Filter<Record> = { $exists: { field: 'settings.unknown' } };

// Filter by one column
const filterByOneColumn: Filter<Record> = { name: 'r1' };

// Filter with the $is operator
const filterWithTheIsOperator: Filter<Record> = { name: { $is: 'r1' } };

// Filter with dot notation
const filterWithDotNotation: Filter<Record> = { 'settings.plan': 'free' };

// Filter with nested object
const filterWithNestedObject: Filter<Record> = { 'settings.plan': { $is: 'free' } };

// Filter with $any operation
const filterWithAnyOperation: Filter<Record> = { 'settings.plan': { $any: ['free', 'paid'] } };

// Filter with and operations
const filterWithAndOperations: Filter<Record> = { 'settings.dark': true, 'settings.plan': 'free' };

// Filter with both and and any operations
const filterWithBothAndAndAnyOperations: Filter<Record> = {
  $any: { 'settings.dark': true, 'settings.plan': 'free' }
};

// Filter with both and and any operations in array
const filterWithBothAndAndAnyOperationsInArray: Filter<Record> = { $any: [{ name: 'r1' }, { name: 'r2' }] };

// Filter with exists operation
const filterWithExistsOperation: Filter<Record> = { $exists: 'settings' };

// Filter with exists, and and any operations
const filterWithExistsAndAndAnyOperations: Filter<Record> = {
  $all: [{ $exists: 'settings' }, { $exists: 'name' }]
};

// Filter with not exists operation
const filterWithNotExistsOperation: Filter<Record> = { $notExists: 'settings' };

// Filter with partial match
const filterWithPartialMatch: Filter<Record> = { name: { $contains: 'value' } };

// Filter with pattern operator
const filterWithPatternOperator: Filter<Record> = { name: { $pattern: 'value' } };

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

// Filters with $includesAll
const filtersWithIncludesAll: Filter<Record> = {
  'settings.labels': {
    $includesAll: [{ $contains: 'label' }]
  }
};

// Filter with invalid property type
// @ts-expect-error
const filterWithInvalidPropertyType: Filter<Record> = { name: 42 };

// Filter with invalid dot notation property type
// @ts-expect-error
const filterWithInvalidNestedPropertyType: Filter<Record> = { 'settings.plan': 42 };

// Filter with invalid nested object property type
// @ts-expect-error
const filterWithInvalidNestedObjectPropertyType: Filter<Record> = { settings: { plan: 42 } };

// Filter with invalid property $is type
// @ts-expect-error
const filterWithInvalidOperator: Filter<Record> = { name: { $is: 42 } };

// Filter with wildcard is not allowed
// @ts-expect-error
const filterWithWildcardIsNotAllowed: Filter<Record> = { '*': { $is: 'foo' } };

// Filter with link wildcard is not allowed
// @ts-expect-error
const filterWithLinkWildcardIsNotAllowed: Filter<Record> = { 'settings.*': { $is: 'foo' } };

// Filter on internal column is allowed
const filterOnInternalColumnIsAllowed: Filter<Record> = { 'xata.version': { $is: 4 } };

test('fake test', () => {
  // This is a fake test to make sure that the type definitions in this file are working
});

describe('cleanFilter', () => {
  test('should remove empty objects', () => {
    const filter = { $and: [{}, { name: 'r1' }, {}] };
    expect(cleanFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "$and": [
          {
            "name": "r1",
          },
        ],
      }
    `);
  });

  test('should remove empty arrays', () => {
    const filter = { $and: [[], { name: 'r1' }, []] };
    expect(cleanFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "$and": [
          {
            "name": "r1",
          },
        ],
      }
    `);
  });

  test('should remove empty strings', () => {
    const filter = { $and: ['', { name: 'r1' }, ''] };
    expect(cleanFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "$and": [
          {
            "name": "r1",
          },
        ],
      }
    `);
  });

  test("should remove 'null' values", () => {
    const filter = { $and: [{ name: null }, { name: 'r1' }, { name: null }] };
    expect(cleanFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "$and": [
          {
            "name": "r1",
          },
        ],
      }
    `);
  });

  test("should remove 'undefined' values", () => {
    const filter = { $and: [{ name: undefined }, { name: 'r1' }, { name: undefined }] };
    expect(cleanFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "$and": [
          {
            "name": "r1",
          },
        ],
      }
    `);
  });

  test('should remove objects with values to be removed', () => {
    const filter = { $and: [{ name: { $is: null } }, { name: 'r1' }, { name: { $is: null } }] };
    expect(cleanFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "$and": [
          {
            "name": "r1",
          },
        ],
      }
    `);
  });

  test('should remove arrays with values to be removed', () => {
    const filter = { $and: [{ name: { $any: [null] } }, { name: 'r1' }, { name: { $any: [null] } }] };
    expect(cleanFilter(filter as FilterExpression)).toMatchInlineSnapshot(`
      {
        "$and": [
          {
            "name": "r1",
          },
        ],
      }
    `);
  });
});

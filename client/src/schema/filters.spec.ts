// eslint-disable no-unused-vars
import { ApiFilter } from './filters';
import { XataRecord } from './record';

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
const singleColumnWithImplicitIs: ApiFilter<Record> = { name: 'r2' };

// Single column with explicit is
const singleColumnWithExplicitIs: ApiFilter<Record> = { name: { $is: 'r2' } };

// Is string
const isString: ApiFilter<Record> = { string: 'string' };

// Is true
const isTrue: ApiFilter<Record> = { boolean: true };

// Is false
const isFalse: ApiFilter<Record> = { boolean: false };

// Is pos int
const isPosInt: ApiFilter<Record> = { number: 1234567 };

// Is neg int
const isNegInt: ApiFilter<Record> = { number: -42 };

// Is float
const isFloat: ApiFilter<Record> = { number: 3.14 };

//  with dots
const withDots: ApiFilter<Record> = { 'settings.plan': 'free' };

// Nested columns
const nestedColumns: ApiFilter<Record> = { settings: { plan: 'free' } };

// Nested columns array
const nestedColumnsArray: ApiFilter<Record> = { settings: [{ dark: false }, { plan: 'free' }] };

// Nested columns any
const nestedColumnsAny: ApiFilter<Record> = { settings: { $any: [{ plan: 'free' }, { plan: 'trial' }] } };

// Nested columns any value
const nestedColumnsAnyValue: ApiFilter<Record> = { settings: { plan: { $any: ['free', 'trial'] } } };

// Or with $any
const orWithAny: ApiFilter<Record> = { 'settings.plan': { $any: ['free', 'paid'] } };

// Multiple columns implicit and
const multipleColumnsImplicitAnd: ApiFilter<Record> = { 'settings.dark': true, 'settings.plan': 'free' };

// Explicit $all with multi-key filter list
const explicitAllWithMultiKeyFilterList: ApiFilter<Record> = {
  $all: { 'settings.dark': true, 'settings.plan': 'free' }
};

// Explicit $all with filter list
const explicitAllWithFilterList: ApiFilter<Record> = { $all: [{ 'settings.dark': true }, { 'settings.plan': 'free' }] };

// Explicit $any with multi-key filter list
const explicitAnyWithMultiKeyFilterList: ApiFilter<Record> = {
  $all: { 'settings.dark': true, 'settings.plan': 'free' }
};

// Explicit $any with filter list
const explicitAnyWithFilterList: ApiFilter<Record> = { $any: [{ 'settings.dark': true }, { 'settings.plan': 'free' }] };

// $any with multiple values
const anyWithMultipleValues: ApiFilter<Record> = { number: { $any: [1, 2, 3] } };

// $none with multiple values
const noneWithMultipleValues: ApiFilter<Record> = { number: { $none: [1, 2, 3] } };

// Exists filter
const existsFilter: ApiFilter<Record> = { $exists: 'test' };

// Not exists filter
const notExistsFilter: ApiFilter<Record> = { $notExists: 'test' };

// Exists with all
const existsWithAll: ApiFilter<Record> = { $all: [{ $exists: 'settings' }, { $exists: 'name' }] };

// Nest any with not
const nestAnyWithNot: ApiFilter<Record> = { $not: { $any: { 'settings.dark': true, 'settings.plan': 'free' } } };

// Mix $all and $any with extra keys
const mixAllAndAnyWithExtraKeys: ApiFilter<Record> = {
  $all: { $any: { 'settings.dark': false, 'settings.plan': 'free' }, name: 'r1' }
};

// Range query with less first
const rangeQueryWithLessFirst: ApiFilter<Record> = { age: { $lt: 30, $ge: 20 } };

// Range query with greater first
const rangeQueryWithGreaterFirst: ApiFilter<Record> = { age: { $ge: 20, $lt: 30 } };

// Ordered op
const orderedOp: ApiFilter<Record> = { age: { $lt: 30 } };

// Simple includes
const simpleIncludes: ApiFilter<Record> = { labels: { $includes: 'test' } };

// Simple includes with op
const simpleIncludesWithOp: ApiFilter<Record> = { labels: { $includes: { $contains: 'test' } } };

// Simple includes multiple
const simpleIncludesMultiple: ApiFilter<Record> = { labels: { $includes: ['a', 'b', 'c'] } };

// Simple includes multiple with op
const simpleIncludesMultipleWithOp: ApiFilter<Record> = {
  labels: { $includes: [{ $is: 'a' }, { $is: 'b' }, { $is: 'c' }] }
};

// Includes with many comparisons
const includesWithManyComparisons: ApiFilter<Record> = {
  labels: { $includes: { $all: [{ $contains: 'a' }, { $contains: 'b' }] } }
};

// Simple includes multiple op and value
const simpleIncludesMultipleOpAndValue: ApiFilter<Record> = { labels: { $includes: [{ $contains: 'a' }, 'b'] } };

// Includes with mode and array of filters
const includesWithModeAndArrayOfFilters: ApiFilter<Record> = {
  labels: { $includesNone: [{ $contains: 'test' }, 'abc', { $endsWith: 'bad' }] }
};

// Includes with mix of any and all in predicate position
const includesWithMixOfAnyAndAllInPredicatePosition: ApiFilter<Record> = {
  labels: { $includes: { $any: { $all: [{ $startsWith: 'test' }, { $contains: 'x' }], $any: ['a', 'b'] } } }
};

// Simple $includesany
const simpleIncludesAny: ApiFilter<Record> = { labels: { $includesAny: 'test' } };

// Simple $includesall
const simpleIncludesAll: ApiFilter<Record> = { labels: { $includesAll: 'test' } };

// Simple $includesnone
const simpleIncludesNone: ApiFilter<Record> = { labels: { $includesNone: 'test' } };

// Exists value must be string not int
// @ts-expect-error
const existsValueMustBeStringNotInt: ApiFilter<Record> = { $exists: 42 };

// Exists value must be string not objct
// @ts-expect-error
const existsValueMustBeStringNotObject: ApiFilter<Record> = { $exists: { field: 'settings.unknown' } };

// Filter by one column
const filterByOneColumn: ApiFilter<Record> = { name: 'r1' };

// Filter with the $is operator
const filterWithTheIsOperator: ApiFilter<Record> = { name: { $is: 'r1' } };

// Filter with dot notation
const filterWithDotNotation: ApiFilter<Record> = { 'settings.plan': 'free' };

// Filter with nested object
const filterWithNestedObject: ApiFilter<Record> = { 'settings.plan': { $is: 'free' } };

// Filter with $any operation
const filterWithAnyOperation: ApiFilter<Record> = { 'settings.plan': { $any: ['free', 'paid'] } };

// Filter with and operations
const filterWithAndOperations: ApiFilter<Record> = { 'settings.dark': true, 'settings.plan': 'free' };

// Filter with both and and any operations
const filterWithBothAndAndAnyOperations: ApiFilter<Record> = {
  $any: { 'settings.dark': true, 'settings.plan': 'free' }
};

// Filter with both and and any operations in array
const filterWithBothAndAndAnyOperationsInArray: ApiFilter<Record> = { $any: [{ name: 'r1' }, { name: 'r2' }] };

// Filter with exists operation
const filterWithExistsOperation: ApiFilter<Record> = { $exists: 'settings' };

// Filter with exists, and and any operations
const filterWithExistsAndAndAnyOperations: ApiFilter<Record> = { $all: [{ $exists: 'settings' }, { $exists: 'name' }] };

// Filter with not exists operation
const filterWithNotExistsOperation: ApiFilter<Record> = { $notExists: 'settings' };

// Filter with partial match
const filterWithPartialMatch: ApiFilter<Record> = { name: { $contains: 'value' } };

// Filter with pattern operator
const filterWithPatternOperator: ApiFilter<Record> = { name: { $pattern: 'value' } };

// Filter with $startsWith and $endsWith operators
const filterWithStartsWithAndEndsWithOperators: ApiFilter<Record> = {
  name: { $startsWith: 'value', $endsWith: 'value' }
};

// Filter with numeric ranges
const filterWithNumericRanges: ApiFilter<Record> = { age: { $lt: 30, $ge: 20 } };

// Filter with negations
const filterWithNegations: ApiFilter<Record> = { $not: { name: 'r1' } };

// Filter with complex negations
const filterWithComplexNegations: ApiFilter<Record> = { $not: { $any: [{ name: 'r1' }, { name: 'r2' }] } };

// Filter with arrays complex negations
const filterWithArraysComplexNegations: ApiFilter<Record> = {
  labels: {
    $includes: {
      $all: [{ $contains: 'label' }, { $not: { $endsWith: '-debug' } }]
    }
  }
};

// Filters with $includesAll
const filtersWithIncludesAll: ApiFilter<Record> = {
  'settings.labels': {
    $includesAll: [{ $contains: 'label' }]
  }
};

test('fake test', () => {
  // This is a fake test to make sure that the type definitions in this file are working
});

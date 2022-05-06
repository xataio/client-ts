/* eslint-disable @typescript-eslint/no-unused-vars */
import { FilterObject } from './filters';
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
const singleColumnWithImplicitIs: FilterObject<Record> = { name: 'r2' };

// Single column with explicit is
const singleColumnWithExplicitIs: FilterObject<Record> = { name: { $is: 'r2' } };

// Is string
const isString: FilterObject<Record> = { string: 'string' };

// Is true
const isTrue: FilterObject<Record> = { boolean: true };

// Is false
const isFalse: FilterObject<Record> = { boolean: false };

// Is pos int
const isPosInt: FilterObject<Record> = { number: 1234567 };

// Is neg int
const isNegInt: FilterObject<Record> = { number: -42 };

// Is float
const isFloat: FilterObject<Record> = { number: 3.14 };

//  with dots
const withDots: FilterObject<Record> = { 'settings.plan': 'free' };

// Nested columns
const nestedColumns: FilterObject<Record> = { settings: { plan: 'free' } };

// Nested columns array
const nestedColumnsArray: FilterObject<Record> = { settings: [{ dark: false }, { plan: 'free' }] };

// Nested columns any
const nestedColumnsAny: FilterObject<Record> = { settings: { $any: [{ plan: 'free' }, { plan: 'trial' }] } };

// Nested columns any value
const nestedColumnsAnyValue: FilterObject<Record> = { settings: { plan: { $any: ['free', 'trial'] } } };

// Or with $any
const orWithAny: FilterObject<Record> = { 'settings.plan': { $any: ['free', 'paid'] } };

// Multiple columns implicit and
const multipleColumnsImplicitAnd: FilterObject<Record> = { 'settings.dark': true, 'settings.plan': 'free' };

// Explicit $all with multi-key filter list
const explicitAllWithMultiKeyFilterList: FilterObject<Record> = {
  $all: { 'settings.dark': true, 'settings.plan': 'free' }
};

// Explicit $all with filter list
const explicitAllWithFilterList: FilterObject<Record> = {
  $all: [{ 'settings.dark': true }, { 'settings.plan': 'free' }]
};

// Explicit $any with multi-key filter list
const explicitAnyWithMultiKeyFilterList: FilterObject<Record> = {
  $all: { 'settings.dark': true, 'settings.plan': 'free' }
};

// Explicit $any with filter list
const explicitAnyWithFilterList: FilterObject<Record> = {
  $any: [{ 'settings.dark': true }, { 'settings.plan': 'free' }]
};

// $any with multiple values
const anyWithMultipleValues: FilterObject<Record> = { number: { $any: [1, 2, 3] } };

// $none with multiple values
const noneWithMultipleValues: FilterObject<Record> = { number: { $none: [1, 2, 3] } };

// Exists filter
const existsFilter: FilterObject<Record> = { $exists: 'test' };

// Not exists filter
const notExistsFilter: FilterObject<Record> = { $notExists: 'test' };

// Exists with all
const existsWithAll: FilterObject<Record> = { $all: [{ $exists: 'settings' }, { $exists: 'name' }] };

// Nest any with not
const nestAnyWithNot: FilterObject<Record> = { $not: { $any: { 'settings.dark': true, 'settings.plan': 'free' } } };

// Mix $all and $any with extra keys
const mixAllAndAnyWithExtraKeys: FilterObject<Record> = {
  $all: { $any: { 'settings.dark': false, 'settings.plan': 'free' }, name: 'r1' }
};

// Range query with less first
const rangeQueryWithLessFirst: FilterObject<Record> = { age: { $lt: 30, $ge: 20 } };

// Range query with greater first
const rangeQueryWithGreaterFirst: FilterObject<Record> = { age: { $ge: 20, $lt: 30 } };

// Ordered op
const orderedOp: FilterObject<Record> = { age: { $lt: 30 } };

// Simple includes
const simpleIncludes: FilterObject<Record> = { labels: { $includes: 'test' } };

// Simple includes with op
const simpleIncludesWithOp: FilterObject<Record> = { labels: { $includes: { $contains: 'test' } } };

// Simple includes multiple
const simpleIncludesMultiple: FilterObject<Record> = { labels: { $includes: ['a', 'b', 'c'] } };

// Simple includes multiple with op
const simpleIncludesMultipleWithOp: FilterObject<Record> = {
  labels: { $includes: [{ $is: 'a' }, { $is: 'b' }, { $is: 'c' }] }
};

// Includes with many comparisons
const includesWithManyComparisons: FilterObject<Record> = {
  labels: { $includes: { $all: [{ $contains: 'a' }, { $contains: 'b' }] } }
};

// Simple includes multiple op and value
const simpleIncludesMultipleOpAndValue: FilterObject<Record> = { labels: { $includes: [{ $contains: 'a' }, 'b'] } };

// Includes with mode and array of filters
const includesWithModeAndArrayOfFilters: FilterObject<Record> = {
  labels: { $includesNone: [{ $contains: 'test' }, 'abc', { $endsWith: 'bad' }] }
};

// Includes with mix of any and all in predicate position
const includesWithMixOfAnyAndAllInPredicatePosition: FilterObject<Record> = {
  labels: { $includes: { $any: { $all: [{ $startsWith: 'test' }, { $contains: 'x' }], $any: ['a', 'b'] } } }
};

// Simple $includesany
const simpleIncludesAny: FilterObject<Record> = { labels: { $includesAny: 'test' } };

// Simple $includesall
const simpleIncludesAll: FilterObject<Record> = { labels: { $includesAll: 'test' } };

// Simple $includesnone
const simpleIncludesNone: FilterObject<Record> = { labels: { $includesNone: 'test' } };

// Exists value must be string not int
// @ts-expect-error
const existsValueMustBeStringNotInt: FilterObject<Record> = { $exists: 42 };

// Exists value must be string not objct
// @ts-expect-error
const existsValueMustBeStringNotObject: FilterObject<Record> = { $exists: { field: 'settings.unknown' } };

// Filter by one column
const filterByOneColumn: FilterObject<Record> = { name: 'r1' };

// Filter with the $is operator
const filterWithTheIsOperator: FilterObject<Record> = { name: { $is: 'r1' } };

// Filter with dot notation
const filterWithDotNotation: FilterObject<Record> = { 'settings.plan': 'free' };

// Filter with nested object
const filterWithNestedObject: FilterObject<Record> = { 'settings.plan': { $is: 'free' } };

// Filter with $any operation
const filterWithAnyOperation: FilterObject<Record> = { 'settings.plan': { $any: ['free', 'paid'] } };

// Filter with and operations
const filterWithAndOperations: FilterObject<Record> = { 'settings.dark': true, 'settings.plan': 'free' };

// Filter with both and and any operations
const filterWithBothAndAndAnyOperations: FilterObject<Record> = {
  $any: { 'settings.dark': true, 'settings.plan': 'free' }
};

// Filter with both and and any operations in array
const filterWithBothAndAndAnyOperationsInArray: FilterObject<Record> = { $any: [{ name: 'r1' }, { name: 'r2' }] };

// Filter with exists operation
const filterWithExistsOperation: FilterObject<Record> = { $exists: 'settings' };

// Filter with exists, and and any operations
const filterWithExistsAndAndAnyOperations: FilterObject<Record> = {
  $all: [{ $exists: 'settings' }, { $exists: 'name' }]
};

// Filter with not exists operation
const filterWithNotExistsOperation: FilterObject<Record> = { $notExists: 'settings' };

// Filter with partial match
const filterWithPartialMatch: FilterObject<Record> = { name: { $contains: 'value' } };

// Filter with pattern operator
const filterWithPatternOperator: FilterObject<Record> = { name: { $pattern: 'value' } };

// Filter with $startsWith and $endsWith operators
const filterWithStartsWithAndEndsWithOperators: FilterObject<Record> = {
  name: { $startsWith: 'value', $endsWith: 'value' }
};

// Filter with numeric ranges
const filterWithNumericRanges: FilterObject<Record> = { age: { $lt: 30, $ge: 20 } };

// Filter with negations
const filterWithNegations: FilterObject<Record> = { $not: { name: 'r1' } };

// Filter with complex negations
const filterWithComplexNegations: FilterObject<Record> = { $not: { $any: [{ name: 'r1' }, { name: 'r2' }] } };

// Filter with arrays complex negations
const filterWithArraysComplexNegations: FilterObject<Record> = {
  labels: {
    $includes: {
      $all: [{ $contains: 'label' }, { $not: { $endsWith: '-debug' } }]
    }
  }
};

// Filters with $includesAll
const filtersWithIncludesAll: FilterObject<Record> = {
  'settings.labels': {
    $includesAll: [{ $contains: 'label' }]
  }
};

// Filter with invalid property type
// @ts-expect-error
const filterWithInvalidPropertyType: FilterObject<Record> = { name: 42 };

// Filter with invalid dot notation property type
// @ts-expect-error
const filterWithInvalidNestedPropertyType: FilterObject<Record> = { 'settings.plan': 42 };

// Filter with invalid nested object property type
// @ts-expect-error
const filterWithInvalidNestedObjectPropertyType: FilterObject<Record> = { settings: { plan: 42 } };

// Filter with invalid property $is type
// @ts-expect-error
const filterWithInvalidOperator: FilterObject<Record> = { name: { $is: 42 } };

test('fake test', () => {
  // This is a fake test to make sure that the type definitions in this file are working
});

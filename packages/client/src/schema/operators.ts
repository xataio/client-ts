import {
  ArrayFilter,
  ComparableType,
  ComparableTypeFilter,
  ExistanceFilter,
  PropertyFilter,
  StringTypeFilter
} from './filters';
import { SelectableColumn } from './selection';

/**
 * Operator to restrict results to only values that are greater than the given value.
 */
export const gt = <T extends ComparableType>(value: T): ComparableTypeFilter<T> => ({ $gt: value });

/**
 * Operator to restrict results to only values that are greater than the given value.
 */
export const greaterThan = <T extends ComparableType>(value: T): ComparableTypeFilter<T> => ({ $gt: value });

/**
 * Operator to restrict results to only values that are greater than or equal to the given value.
 */
export const ge = <T extends ComparableType>(value: T): ComparableTypeFilter<T> => ({ $ge: value });

/**
 * Operator to restrict results to only values that are greater than or equal to the given value.
 */
export const greaterEquals = <T extends ComparableType>(value: T): ComparableTypeFilter<T> => ({ $ge: value });

/**
 * Operator to restrict results to only values that are greater than or equal to the given value.
 */
export const gte = <T extends ComparableType>(value: T): ComparableTypeFilter<T> => ({ $ge: value });

/**
 * Operator to restrict results to only values that are greater than or equal to the given value.
 */
export const greaterThanEquals = <T extends ComparableType>(value: T): ComparableTypeFilter<T> => ({ $ge: value });

/**
 * Operator to restrict results to only values that are lower than the given value.
 */
export const lt = <T extends ComparableType>(value: T): ComparableTypeFilter<T> => ({ $lt: value });

/**
 * Operator to restrict results to only values that are lower than the given value.
 */
export const lessThan = <T extends ComparableType>(value: T): ComparableTypeFilter<T> => ({ $lt: value });

/**
 * Operator to restrict results to only values that are lower than or equal to the given value.
 */
export const le = <T extends ComparableType>(value: T): ComparableTypeFilter<T> => ({ $le: value });

/**
 * Operator to restrict results to only values that are lower than or equal to the given value.
 */
export const lessEquals = <T extends ComparableType>(value: T): ComparableTypeFilter<T> => ({ $le: value });

/**
 * Operator to restrict results to only values that are lower than or equal to the given value.
 */
export const lte = <T extends ComparableType>(value: T): ComparableTypeFilter<T> => ({ $le: value });

/**
 * Operator to restrict results to only values that are lower than or equal to the given value.
 */
export const lessThanEquals = <T extends ComparableType>(value: T): ComparableTypeFilter<T> => ({ $le: value });

/**
 * Operator to restrict results to only values that are not null.
 */
export const exists = <T>(column: SelectableColumn<T>): ExistanceFilter<T> => ({ $exists: column });

/**
 * Operator to restrict results to only values that are null.
 */
export const notExists = <T>(column: SelectableColumn<T>): ExistanceFilter<T> => ({ $notExists: column });

/**
 * Operator to restrict results to only values that start with the given prefix.
 */
export const startsWith = (value: string): StringTypeFilter => ({ $startsWith: value });

/**
 * Operator to restrict results to only values that end with the given suffix.
 */
export const endsWith = (value: string): StringTypeFilter => ({ $endsWith: value });

/**
 * Operator to restrict results to only values that match the given pattern.
 */
export const pattern = (value: string): StringTypeFilter => ({ $pattern: value });

/**
 * Operator to restrict results to only values that are equal to the given value.
 */
export const is = <T>(value: T): PropertyFilter<T> => ({ $is: value });

/**
 * Operator to restrict results to only values that are equal to the given value.
 */
export const equals = <T>(value: T): PropertyFilter<T> => ({ $is: value });

/**
 * Operator to restrict results to only values that are not equal to the given value.
 */
export const isNot = <T>(value: T): PropertyFilter<T> => ({ $isNot: value });

/**
 * Operator to restrict results to only values that contain the given value.
 */
export const contains = (value: string): StringTypeFilter => ({ $contains: value });

/**
 * Operator to restrict results if some array items match the predicate.
 */
export const includes = <T>(value: T): ArrayFilter<T> => ({ $includes: value });

/**
 * Operator to restrict results if all array items match the predicate.
 */
export const includesAll = <T>(value: T): ArrayFilter<T> => ({ $includesAll: value });

/**
 * Operator to restrict results if none array items match the predicate.
 */
export const includesNone = <T>(value: T): ArrayFilter<T> => ({ $includesNone: value });

/**
 * Operator to restrict results if some array items match the predicate.
 */
export const includesAny = <T>(value: T): ArrayFilter<T> => ({ $includesAny: value });

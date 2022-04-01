import { Constraint } from './filters';

type ComparableType = number | Date;

/**
 * Operator to restrict results to only values that are greater than the given value.
 */
export const gt = <T extends ComparableType>(value: T): Constraint<T> => ({ $gt: value });

/**
 * Operator to restrict results to only values that are greater than or equal to the given value.
 */
export const ge = <T extends ComparableType>(value: T): Constraint<T> => ({ $ge: value });
/**
 * Operator to restrict results to only values that are greater than or equal to the given value.
 */
export const gte = <T extends ComparableType>(value: T): Constraint<T> => ({ $ge: value });
/**
 * Operator to restrict results to only values that are lower than the given value.
 */
export const lt = <T extends ComparableType>(value: T): Constraint<T> => ({ $lt: value });
/**
 * Operator to restrict results to only values that are lower than or equal to the given value.
 */
export const lte = <T extends ComparableType>(value: T): Constraint<T> => ({ $le: value });
/**
 * Operator to restrict results to only values that are lower than or equal to the given value.
 */
export const le = <T extends ComparableType>(value: T): Constraint<T> => ({ $le: value });
/**
 * Operator to restrict results to only values that are not null.
 */
export const exists = (column: string): Constraint<string> => ({ $exists: column });
/**
 * Operator to restrict results to only values that are null.
 */
export const notExists = (column: string): Constraint<string> => ({ $notExists: column });
/**
 * Operator to restrict results to only values that start with the given prefix.
 */
export const startsWith = (value: string): Constraint<string> => ({ $startsWith: value });
/**
 * Operator to restrict results to only values that end with the given suffix.
 */
export const endsWith = (value: string): Constraint<string> => ({ $endsWith: value });
/**
 * Operator to restrict results to only values that match the given pattern.
 */
export const pattern = (value: string): Constraint<string> => ({ $pattern: value });
/**
 * Operator to restrict results to only values that are equal to the given value.
 */
export const is = <T>(value: T): Constraint<T> => ({ $is: value });
/**
 * Operator to restrict results to only values that are not equal to the given value.
 */
export const isNot = <T>(value: T): Constraint<T> => ({ $isNot: value });
/**
 * Operator to restrict results to only values that contain the given value.
 */
export const contains = <T>(value: T): Constraint<T> => ({ $contains: value });

// TODO: these can only be applied to columns of type "multiple"
/**
 * Operator to restrict results to only arrays that include the given value.
 */
export const includes = (value: string): Constraint<string> => ({ $includes: value });
/**
 * Operator to restrict results to only arrays that include a value matching the given substring.
 */
export const includesSubstring = (value: string): Constraint<string> => ({ $includesSubstring: value });
/**
 * Operator to restrict results to only arrays that include a value matching the given pattern.
 */
export const includesPattern = (value: string): Constraint<string> => ({ $includesPattern: value });
export const includesAll = (value: string): Constraint<string> => ({ $includesAll: value });

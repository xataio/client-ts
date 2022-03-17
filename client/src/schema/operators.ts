import { ComparableType, Constraint } from './query';

export const gt = <T extends ComparableType>(value: T): Constraint<T> => ({ $gt: value });
export const ge = <T extends ComparableType>(value: T): Constraint<T> => ({ $ge: value });
export const gte = <T extends ComparableType>(value: T): Constraint<T> => ({ $ge: value });
export const lt = <T extends ComparableType>(value: T): Constraint<T> => ({ $lt: value });
export const lte = <T extends ComparableType>(value: T): Constraint<T> => ({ $le: value });
export const le = <T extends ComparableType>(value: T): Constraint<T> => ({ $le: value });
export const exists = (column: string): Constraint<string> => ({ $exists: column });
export const notExists = (column: string): Constraint<string> => ({ $notExists: column });
export const startsWith = (value: string): Constraint<string> => ({ $startsWith: value });
export const endsWith = (value: string): Constraint<string> => ({ $endsWith: value });
export const pattern = (value: string): Constraint<string> => ({ $pattern: value });
export const is = <T>(value: T): Constraint<T> => ({ $is: value });
export const isNot = <T>(value: T): Constraint<T> => ({ $isNot: value });
export const contains = <T>(value: T): Constraint<T> => ({ $contains: value });

// TODO: these can only be applied to columns of type "multiple"
export const includes = (value: string): Constraint<string> => ({ $includes: value });
export const includesSubstring = (value: string): Constraint<string> => ({ $includesSubstring: value });
export const includesPattern = (value: string): Constraint<string> => ({ $includesPattern: value });
export const includesAll = (value: string): Constraint<string> => ({ $includesAll: value });

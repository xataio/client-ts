function notEmpty<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function compact<T>(arr: Array<T | null | undefined>): T[] {
  return arr.filter(notEmpty);
}

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export function isObject(value: any): value is object {
  return value !== undefined && value !== null && typeof value === 'object';
}

export function isString(value: any): value is string {
  return value !== undefined && value !== null && typeof value === 'string';
}

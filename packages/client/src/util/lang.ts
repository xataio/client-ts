function notEmpty<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function compact<T>(arr: Array<T | null | undefined>): T[] {
  return arr.filter(notEmpty);
}

export function compactObject<T>(obj: Record<string, T | null | undefined>): Record<string, T> {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => notEmpty(value))) as Record<string, T>;
}

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export function isObject(value: any): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function isString(value: any): value is string {
  return isDefined(value) && typeof value === 'string';
}

export function toBase64(value: string): string {
  try {
    return btoa(value);
  } catch (err) {
    return Buffer.from(value).toString('base64');
  }
}

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

export function isStringArray(value: any): value is string[] {
  return isDefined(value) && Array.isArray(value) && value.every(isString);
}

export function toBase64(value: string): string {
  try {
    return btoa(value);
  } catch (err) {
    const buf = Buffer; // Avoid "A Node.js API is used which is not supported in the Edge Runtime" in Vercel Edge middleware
    return buf.from(value).toString('base64');
  }
}

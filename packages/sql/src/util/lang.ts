export function isBlob(value: any): value is Blob {
  try {
    return value instanceof Blob;
  } catch (error) {
    // Node prior to v18.0.0 doesn't support instanceof Blob and throws a ReferenceError
    return false;
  }
}

export function isObject(value: any): value is Record<string, unknown> {
  return (
    Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && !isBlob(value)
  );
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

export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

export function isObject<T>(value: T | unknown): value is T {
  return isDefined(value) && typeof value === 'object';
}

export function detectNewline(data: string): '\r' | '\n' | '\r\n' {
  if (data.includes('\r\n')) {
    return '\r\n';
  } else if (data.includes('\r')) {
    return '\r';
  } else {
    return '\n';
  }
}

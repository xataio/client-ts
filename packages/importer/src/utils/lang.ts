import type { XataFile } from '@xata.io/client';

export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

export function isObject<T>(value: T | unknown): value is T {
  return isDefined(value) && typeof value === 'object';
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function notEmpty<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function compact<T>(arr: Array<T | null | undefined>): T[] {
  return arr.filter(notEmpty);
}

export function isXataFile(value: unknown): value is XataFile {
  return isObject(value) && (value as XataFile).base64Content !== undefined;
}

export function partition<T>(array: T[], predicate: (item: T) => boolean): [T[], T[]] {
  return array.reduce(
    (acc, item) => {
      acc[predicate(item) ? 0 : 1].push(item);
      return acc;
    },
    [[], []] as [T[], T[]]
  );
}

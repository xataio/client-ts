import { isDefined, isString } from '../util/lang';

export type JSONValue<Value> = Value & { __json: true };

export function stringifyJson(value: string): string;
export function stringifyJson(value: null): null;
export function stringifyJson(value: undefined): undefined;
export function stringifyJson(value: string | null | undefined): string | null | undefined;
export function stringifyJson<T>(value: any): string;
export function stringifyJson(value: any) {
  if (!isDefined(value)) return value;
  if (isString(value)) return value;

  try {
    return JSON.stringify(value);
  } catch (e) {
    return value;
  }
}

export function parseJson<T>(value: string) {
  try {
    return JSON.parse(value);
  } catch (e) {
    return value as any;
  }
}

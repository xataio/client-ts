import pako from 'pako';
import { base64url } from 'rfc4648';
import stringify from 'json-stringify-deterministic';

export class Cursor<Data> {
  data: Data;

  constructor(cursor: string) {
    const decoded = base64url.parse(cursor, { loose: true });
    const decompressed = pako.inflate(decoded, { to: 'string', raw: true });

    const [encoding, format, ...rest] = decompressed;
    if (encoding !== 'j' || format !== '1') {
      throw new Error('Invalid cursor');
    }

    this.data = JSON.parse(rest.join(''));
  }

  static #encode<Data>(data: Data): string {
    const compressed = pako.deflate('j1' + stringify(data), {
      raw: true,
      strategy: pako.constants.Z_DEFAULT_STRATEGY,
      level: -1
    });

    return base64url.stringify(compressed, { pad: false });
  }

  static from<Data>(data: Data): Cursor<Data> {
    return new Cursor(this.#encode(data));
  }

  toString(): string {
    return Cursor.#encode(this.data);
  }
}

export function compactRecord<T>(record: Record<string, T | undefined>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => !!value)) as Record<string, T>;
}

export function decode(data: string): Record<string, unknown> {
  const decoded = base64url.parse(data, { loose: true });
  const decompressed = pako.inflate(decoded, { to: 'string', raw: true });
  const [encoding, format, ...rest] = decompressed;
  if (encoding !== 'j' || format !== '1') {
    throw new Error('Invalid cursor');
  }

  return JSON.parse(rest.join(''));
}

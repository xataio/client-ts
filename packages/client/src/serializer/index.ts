import { Identifiable, XataRecord } from '../schema/record';

// These will be used to set special fields to serialized objects.
// So objects should not use this field names. I think that's fine. Another approach would be to generate two objects:
// One containing the "data tree" and another containing the a tree with the type information.
const META = '__';
const VALUE = '___';

// TODO: Add types for the serializer
export class Serializer {
  classes: Record<string, any> = {};

  add(clazz: any) {
    this.classes[clazz.name] = clazz;
  }

  toJSON<T>(data: T): string {
    // We are not using JSON.stringify() and the replacer function here, because the replacer receives
    // the result of toJSON() if the object has a toJSON() method. This is a problem for the Date type:
    // we get a string, because Date.toJSON() returns the date formatted into a ISO string alreayd,
    // so it's not possible to guess the type of the original object.
    function visit(obj: any): any {
      if (Array.isArray(obj)) return obj.map(visit);

      const type = typeof obj;
      if (type === 'undefined') return { [META]: 'undefined' };
      if (type === 'bigint') return { [META]: 'bigint', [VALUE]: obj.toString() };
      if (obj === null || type !== 'object') return obj;

      const constructor = obj.constructor;
      const o: Record<string, any> = { [META]: constructor.name };
      for (const [key, value] of Object.entries(obj)) {
        o[key] = visit(value);
      }
      if (constructor === Date) o[VALUE] = obj.toISOString();
      if (constructor === Map) o[VALUE] = Object.fromEntries(obj);
      if (constructor === Set) o[VALUE] = [...obj];
      return o;
    }

    return JSON.stringify(visit(data));
  }

  fromJSON<T>(json: string): T {
    return JSON.parse(json, (key, value) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const { [META]: clazz, [VALUE]: val, ...rest } = value;
        const constructor = this.classes[clazz];

        if (constructor) {
          return Object.assign(Object.create(constructor.prototype), rest);
        }
        if (clazz === 'Date') return new Date(val);
        if (clazz === 'Set') return new Set(val);
        if (clazz === 'Map') return new Map(Object.entries(val));
        if (clazz === 'bigint') return BigInt(val);
        // TODO: this is ignored. In order to support undefined we'd need to traverse the JSON tree ourselves.
        // Instead of using the JSON.parse() reviver argument.
        if (clazz === 'undefined') return undefined;
        return rest;
      }
      return value;
    });
  }
}

const defaultSerializer = new Serializer();

export type SerializedString<T> = string | (string & { __type: T });
export type DeserializedType<T> = T extends SerializedString<infer U> ? U : T;

export const serialize = <T>(data: T): SerializedString<T> => {
  return defaultSerializer.toJSON(data) as SerializedString<T>;
};

export const deserialize = <T extends SerializedString<any>>(json: T): SerializerResult<DeserializedType<T>> => {
  return defaultSerializer.fromJSON(json);
};

export type SerializerResult<T> = T extends XataRecord
  ? Identifiable &
      Omit<
        {
          [K in keyof T]: SerializerResult<T[K]>;
        },
        keyof XataRecord
      >
  : T extends any[]
  ? SerializerResult<T[number]>[]
  : T;

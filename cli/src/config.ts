import z from 'zod';
import set from 'lodash.set';

export function setValue(path: string, schema: z.ZodObject<any>, object: object, value: string) {
  const type = getType(path, schema);
  if (!type) throw new Error(`Unknown path "${path}"`);
  if (type === 'object') throw new Error(`Cannot set value at path "${path}" because it is an object`);

  set(object, path, parseValue(path, type, value));
}

function getType(path: string, schema: z.ZodObject<any>) {
  let current = schema;
  for (const name of path.split('.')) {
    current = current.shape[name];
    if (!current) return null;
  }
  if (current instanceof z.ZodString) return 'string';
  if (current instanceof z.ZodBoolean) return 'boolean';
  if (current instanceof z.ZodNumber) return 'number';
  if (current instanceof z.ZodObject) return 'object';
}

function parseValue(path: string, type: ReturnType<typeof getType>, value: string) {
  if (type === 'boolean') {
    if (!['true', 'false'].includes(value)) throw new Error(`Invalid boolean value "${value}" for path "${path}"`);
    return value === 'true';
  }

  if (type === 'number') {
    const num = +value;
    if (!Number.isFinite(num)) throw new Error(`Invalid number value "${value}" for path "${path}"`);
    return num;
  }

  if (type === 'string') {
    return value;
  }

  throw new Error(`Unkown type "${type}" for path "${path}"`);
}

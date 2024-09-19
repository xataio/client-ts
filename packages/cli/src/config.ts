import z from 'zod';
import set from 'lodash/set';

export const projectConfigSchema = z.object({
  databaseURL: z.string(),
  codegen: z.object({
    output: z.string(),
    moduleType: z.enum(['cjs', 'esm', 'deno']),
    declarations: z.boolean(),
    javascriptTarget: z.enum([
      'es5',
      'es6',
      'es2015',
      'es2016',
      'es2017',
      'es2018',
      'es2019',
      'es2020',
      'es2021',
      'esnext'
    ])
  }),
  experimental: z.object({
    incrementalBuild: z.boolean(),
    workflow: z.boolean()
  })
});

export const partialProjectConfig = projectConfigSchema.deepPartial();

export type ProjectConfig = z.infer<typeof partialProjectConfig>;

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

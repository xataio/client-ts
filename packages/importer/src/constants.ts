import { z } from 'zod';

// We don't yet support importing all Xata column types
export const importColumnTypes = z.enum([
  'bool',
  'int',
  'float',
  'string',
  'text',
  'email',
  'datetime',
  'link',
  'multiple',
  'file',
  'file[]'
]);

import { z } from 'zod';

export const importColumnTypes = z.enum(['bool', 'int', 'float', 'string', 'text', 'email', 'datetime']);

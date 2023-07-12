import { z } from 'zod';

// We don't support importing all Xata column types
// Links are not schema guessed, but can be imported as an id
export const importColumnTypes = z.enum(['bool', 'int', 'float', 'string', 'text', 'email', 'datetime', 'link']);

import { foo, xataWorker } from './xata-worker';
import { PAGINATION_MAX_OFFSET } from '@xata.io/client';

const bar = 'baz';

xataWorker('1', async () => {
  return foo + bar + PAGINATION_MAX_OFFSET;
});

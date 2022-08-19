import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { schema } from './mock_data';

const handlers = [
  rest.get('https://mock.xata.sh/db/xata:branch', (_req, res, ctx) => {
    return res(ctx.json({ schema }));
  }),
  rest.post('https://mock.xata.sh/db/xata:branch/tables/users/query', (_req, res, ctx) => {
    return res(ctx.json({ records: [], meta: { page: { cursor: '', more: false } } }));
  }),
  rest.get('https://mock.xata.sh/db/xata:branch/tables/users/data/rec_1234', (_req, res, ctx) => {
    return res(ctx.json({ id: 'rec_1234', xata: { version: 1 } }));
  }),
  rest.delete('https://mock.xata.sh/db/xata:branch/tables/users/data/rec_1234', (_req, res, ctx) => {
    return res(ctx.json({ id: 'rec_1234', xata: { version: 1 } }));
  })
];

const server = setupServer(...handlers);
export { server, rest };

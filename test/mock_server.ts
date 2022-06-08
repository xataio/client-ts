import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { teamColumns, userColumns } from './mock_data';

const handlers = [
  rest.get(/\/tables\/users\/schema/, (req, res, ctx) => {
    return res(ctx.json({ columns: userColumns }));
  }),
  rest.get(/\/tables\/teams\/schema/, (req, res, ctx) => {
    return res(ctx.json({ columns: teamColumns }));
  }),
  rest.post(/\/tables\/users\/query/, (req, res, ctx) => {
    return res(ctx.json({ records: [], meta: { page: { cursor: '', more: false } } }));
  }),
  rest.get(/\/tables\/users\/data\/rec_1234/, (req, res, ctx) => {
    return res(ctx.json({ id: 'rec_1234', xata: { version: 1 } }));
  })
];

const server = setupServer(...handlers);
export { server, rest };

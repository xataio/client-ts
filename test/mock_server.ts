import { rest } from 'msw';
import { setupServer } from 'msw/node';

const handlers = [
  rest.all('*', (req, res, ctx) => {
    console.error(req.url);
  })
];

const server = setupServer(...handlers);
export { server, rest };

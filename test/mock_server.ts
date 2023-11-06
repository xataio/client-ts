import { http as rest, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { schema } from './mock_data';

const handlers = [
  rest.get('https://mock.xata.sh/db/xata:branch', () => {
    return HttpResponse.json({ schema });
  }),
  rest.post('https://mock.xata.sh/db/xata:branch/tables/users/query', () => {
    return HttpResponse.json({ records: [], meta: { page: { cursor: '', more: false } } });
  }),
  rest.get('https://mock.xata.sh/db/xata:branch/tables/users/data/rec_1234', () => {
    return HttpResponse.json({ id: 'rec_1234', xata: { version: 1 } });
  }),
  rest.delete('https://mock.xata.sh/db/xata:branch/tables/users/data/rec_1234', () => {
    return HttpResponse.json({ id: 'rec_1234', xata: { version: 1 } });
  })
];

const server = setupServer(...handlers);
export { server, rest };

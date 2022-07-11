import { xataWorker } from './xata';
import _ from 'lodash';

const worker = xataWorker('name-prefix', async ({ xata }, name: string) => {
  console.log('foo');
  return { first: await xata.db.teams.getFirst(), foo: _.compact([1, 2, undefined, 3]), name, foo2: name };
});

async function main() {
  const foo = await worker('foobar');
  console.log(foo);
}

main();

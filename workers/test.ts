import { xataWorker } from './xata';

const worker = xataWorker('name-prefix', ({ xata }, name: string) => {
  return xata.db.teams.filter('name', name).getAll();
});

async function main() {
  const foo = await worker('xata');
  console.log(foo);
}

main();

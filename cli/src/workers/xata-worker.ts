type Worker = unknown;

export function xataWorker<T extends (...args: any[]) => any>(callback: T): Worker;
export function xataWorker<T extends (...args: any[]) => any>(name: string, callback: T): Worker;
export function xataWorker<T extends (...args: any[]) => any>(a: T | string, b?: T): Worker {
  console.log('xataWorker', a, b);

  // If env is development: return the worker fn directly
  // If env is production: return a fn that calls https://workers.xata.io?worker=name-prefix-1241hg2&args=${b}

  throw new Error('Not implemented');
}

export const foo = 'bar';

/**
 xataWorker("name-prefix-1241hg2", ({ xata, ctx }) => {
    return xata.db.teams.filter("name", ctx.name).getAll();
 })
 */

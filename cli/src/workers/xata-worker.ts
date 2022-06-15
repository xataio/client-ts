type Worker = unknown;

export function xataWorker<T extends (...args: any[]) => any>(callback: T): Worker;
export function xataWorker<T extends (...args: any[]) => any>(name: string, callback: T): Worker;
export function xataWorker<T extends (...args: any[]) => any>(a: T | string, b?: T): Worker {
  console.log('xataWorker', a, b);
  throw new Error('Not implemented');
}

export const foo = 'bar';

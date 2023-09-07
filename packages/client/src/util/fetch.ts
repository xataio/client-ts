import { parseNumber, timeout, timeoutWithCancel } from './lang';

const REQUEST_TIMEOUT = 60000;

export type RequestInit = { body?: any; headers?: Record<string, string>; method?: string; signal?: any };
export type Response = {
  ok: boolean;
  status: number;
  url: string;
  json(): Promise<any>;
  text(): Promise<string>;
  blob(): Promise<Blob>;
  headers?: {
    get(name: string): string | null;
  };
};

// Typed only the subset of the spec we actually use (to be able to build a simple mock)
export type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

export function getFetchImplementation(userFetch?: FetchImpl) {
  // @ts-ignore - fetch might not be a global
  const globalFetch = typeof fetch !== 'undefined' ? fetch : undefined;
  // @ts-ignore - globalThis might not be a global
  const globalThisFetch = typeof globalThis !== 'undefined' ? globalThis.fetch : undefined;
  const fetchImpl: FetchImpl | undefined = userFetch ?? globalFetch ?? globalThisFetch;
  if (!fetchImpl) {
    /** @todo add a link after docs exist */
    throw new Error(`Couldn't find a global \`fetch\`. Pass a fetch implementation explicitly.`);
  }
  return fetchImpl;
}

export class ApiRequestPool {
  #fetch?: FetchImpl;
  #queue: Array<(...params: any[]) => any>;
  #concurrency: number;

  running: number;
  started: number;

  constructor(concurrency = 10) {
    this.#queue = [];
    this.#concurrency = concurrency;

    this.running = 0;
    this.started = 0;
  }

  setFetch(fetch: FetchImpl) {
    this.#fetch = fetch;
  }

  getFetch(): FetchImpl {
    if (!this.#fetch) {
      throw new Error('Fetch not set');
    }

    return this.#fetch;
  }

  request(url: string, options?: RequestInit): Promise<Response> {
    const start = new Date();
    const fetchImpl = this.getFetch();

    const runRequest = async (stalled = false): Promise<Response> => {
      // Some fetch implementations don't timeout and network changes hang the connection
      const { promise, cancel } = timeoutWithCancel(REQUEST_TIMEOUT);
      const response = await Promise.any([
        Promise.resolve(fetchImpl(url, options)),
        promise.then(async () => null)
      ]).finally(cancel);
      if (!response) {
        throw new Error('Request timed out');
      }

      if (response.status === 429) {
        const rateLimitReset = parseNumber(response.headers?.get('x-ratelimit-reset')) ?? 1;

        await timeout(rateLimitReset * 1000);
        return await runRequest(true);
      }

      if (stalled) {
        const stalledTime = new Date().getTime() - start.getTime();
        console.warn(`A request to Xata hit branch rate limits, was retried and stalled for ${stalledTime}ms`);
      }

      return response;
    };

    return this.#enqueue(async () => {
      return await runRequest();
    });
  }
  #enqueue<Result>(task: () => Promise<Result>): Promise<Result> {
    const promise = new Promise<Result>((resolve) => this.#queue.push(resolve))
      .finally(() => {
        this.started--;
        this.running++;
      })
      .then(() => task())
      .finally(() => {
        this.running--;

        const next = this.#queue.shift();
        if (next !== undefined) {
          this.started++;
          next();
        }
      });

    if (this.running + this.started < this.#concurrency) {
      const next = this.#queue.shift();
      if (next !== undefined) {
        this.started++;
        next();
      }
    }

    return promise;
  }
}

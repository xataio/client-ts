import { parseNumber, timeout } from './lang';

const isInternalDebug = process.env.XATA_INTERNAL_DEBUG === 'true';

export type RequestInit = { body?: string; headers?: Record<string, string>; method?: string; signal?: any };
export type Response = {
  ok: boolean;
  status: number;
  url: string;
  json(): Promise<any>;
  headers?: {
    get(name: string): string | null;
  };
};

// Typed only the subset of the spec we actually use (to be able to build a simple mock)
export type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

export function getFetchImplementation(userFetch?: FetchImpl) {
  // @ts-ignore - fetch might not be a global
  const globalFetch = typeof fetch !== 'undefined' ? fetch : undefined;
  const fetchImpl = userFetch ?? globalFetch;
  if (!fetchImpl) {
    /** @todo add a link after docs exist */
    throw new Error(
      `Couldn't find \`fetch\`. Install a fetch implementation such as \`node-fetch\` and pass it explicitly.`
    );
  }
  return fetchImpl;
}

export class ApiRequestPool {
  #fetch?: FetchImpl;
  #queue: Array<(...params: any[]) => any>;
  #concurrency: number;

  running: number;
  started: number;
  total: number;

  constructor(concurrency = 10) {
    this.#queue = [];
    this.#concurrency = concurrency;

    this.running = 0;
    this.started = 0;
    this.total = 0;
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

  async request(url: string, options?: RequestInit): Promise<Response> {
    const id = this.total++;
    const start = new Date();
    const fetch = this.getFetch();

    const runRequest = async (stalled = false): Promise<Response> => {
      try {
        const response = await fetch(url, options);

        if (response.status === 429) {
          const rateLimitReset = parseNumber(response.headers?.get('x-ratelimit-reset')) ?? 1;

          await timeout(rateLimitReset * 1000);
          return await runRequest(true);
        }

        if (stalled) {
          const stalledTime = new Date().getTime() - start.getTime();
          console.warn(`A request to Xata hit your workspace limits, was retried and stalled for ${stalledTime}ms`);
        }

        return response;
      } catch (error: any) {
        if (error.code === 'ECONNRESET') {
          console.error('Connection was reset by server');
        }

        console.error(`A request to Xata failed with error: ${error}`);
        throw error;
      }
    };

    return await this.#enqueue(async () => {
      if (isInternalDebug) {
        console.log(`[XATA] [${new Date().toISOString()}] Request ${id} to ${url}`);
      }

      return await runRequest();
    });
  }

  #enqueue<Result>(task: () => Promise<Result> | Result): Promise<Result> {
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

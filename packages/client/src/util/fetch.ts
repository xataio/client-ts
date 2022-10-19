type RequestInit = { body?: string; headers?: Record<string, string>; method?: string; signal?: any };
type Response = {
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
    const fetch = this.getFetch();

    return this.#enqueue(async () => {
      const response = await fetch(url, options);
      // TODO: Check headers
      return response;
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

    if (this.#queue.length > 0 && this.running + this.started < this.#concurrency) {
      const next = this.#queue.shift();
      if (next !== undefined) {
        this.started++;
        next();
      }
    }

    return promise;
  }
}

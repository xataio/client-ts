// Typed only the subset of the spec we actually use (to be able to build a simple mock)
export type FetchImpl = (
  url: string,
  init?: { body?: string; headers?: Record<string, string>; method?: string; signal?: any }
) => Promise<{
  ok: boolean;
  status: number;
  url: string;
  json(): Promise<any>;
  headers?: {
    get(name: string): string | null;
  };
}>;

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

export class ApiRequestPool<RequestItem extends any> {
  #fetch?: FetchImpl;
  #queue: Array<Function>;
  #concurrency: number;

  running: number;
  started: number;

  constructor(concurrency: number = 10) {
    this.#queue = [];
    this.#concurrency = concurrency;

    this.running = 0;
    this.started = 0;
  }

  setFetch(fetch: FetchImpl) {
    this.#fetch = fetch;
  }

  #enqueue<Result extends RequestItem>(task: () => Promise<Result> | Result): Promise<Result> {
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

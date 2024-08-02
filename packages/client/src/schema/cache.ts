export interface CacheImpl {
  defaultQueryTTL: number;

  getAll(): Promise<Record<string, unknown>>;
  get: <T>(key: string) => Promise<T | null>;
  set: <T>(key: string, value: T) => Promise<void>;
  delete: (key: string) => Promise<void>;
  clear: () => Promise<void>;
}

export interface SimpleCacheOptions {
  max?: number;
  defaultQueryTTL?: number;
}

export class SimpleCache implements CacheImpl {
  #map: Map<string, unknown>;

  capacity: number;
  defaultQueryTTL: number;

  constructor(options: SimpleCacheOptions = {}) {
    this.#map = new Map();
    this.capacity = options.max ?? 500;
    this.defaultQueryTTL = options.defaultQueryTTL ?? 60 * 1000;
  }

  async getAll(): Promise<Record<string, unknown>> {
    return Object.fromEntries(this.#map);
  }

  async get<T>(key: string): Promise<T | null> {
    return (this.#map.get(key) ?? null) as T | null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.delete(key);
    this.#map.set(key, value);

    if (this.#map.size > this.capacity) {
      const leastRecentlyUsed = this.#map.keys().next().value;
      if (leastRecentlyUsed) await this.delete(leastRecentlyUsed);
    }
  }

  async delete(key: string): Promise<void> {
    this.#map.delete(key);
  }

  async clear(): Promise<void> {
    return this.#map.clear();
  }
}

export interface CacheImpl {
  cacheRecords: boolean;
  getAll(): Promise<Record<string, unknown>>;
  get: <T>(key: string) => Promise<T | null>;
  set: <T>(key: string, value: T) => Promise<void>;
  delete: (key: string) => Promise<void>;
  clear: () => Promise<void>;
}

export class SimpleCache implements CacheImpl {
  #map: Map<string, unknown>;

  cacheRecords: boolean;
  capacity: number;

  constructor(options: { max?: number; cacheRecords?: boolean } = {}) {
    this.#map = new Map();
    this.capacity = options.max ?? 500;
    this.cacheRecords = options.cacheRecords ?? true;
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
      await this.delete(leastRecentlyUsed);
    }
  }

  async delete(key: string): Promise<void> {
    this.#map.delete(key);
  }

  async clear(): Promise<void> {
    return this.#map.clear();
  }
}

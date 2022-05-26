export interface CacheImpl {
  getAll(): Promise<Record<string, unknown>>;
  get: <T>(key: string) => Promise<T | null>;
  set: <T>(key: string, value: T) => Promise<void>;
  delete: (key: string) => Promise<void>;
  clear: () => Promise<void>;
}

export class SimpleCache implements CacheImpl {
  #map: Map<string, unknown>;

  constructor() {
    this.#map = new Map();
  }

  async getAll(): Promise<Record<string, unknown>> {
    return Object.fromEntries(this.#map);
  }

  async get<T>(key: string): Promise<T | null> {
    return (this.#map.get(key) ?? null) as T | null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.#map.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.#map.delete(key);
  }

  async clear(): Promise<void> {
    return this.#map.clear();
  }
}

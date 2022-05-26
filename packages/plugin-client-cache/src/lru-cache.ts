import LRU from 'lru-cache';
import { CacheImpl } from '@xata.io/client';

export type LRUCacheOptions = Partial<LRU.Options<string, any>> & { cacheRecords?: boolean };

export class LRUCache implements CacheImpl {
  #cache: LRU<string, any>;
  cacheRecords: boolean;

  constructor(options: LRUCacheOptions = {}) {
    this.#cache = new LRU({ max: 500, ...options });
    this.cacheRecords = options.cacheRecords ?? true;
  }

  async getAll(): Promise<Record<string, unknown>> {
    const entries = this.#cache.dump().map(([key, { value }]) => [key, value]);
    return Object.fromEntries(entries);
  }

  async get<T>(key: string): Promise<T | null> {
    return this.#cache.get<T>(key) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.#cache.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.#cache.delete(key);
  }

  async clear(): Promise<void> {
    this.#cache.clear();
  }
}

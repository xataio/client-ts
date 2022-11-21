import { CacheImpl, serialize, deserialize } from '@xata.io/client';

export type CloudflareKVCacheOptions = { namespace: KVNamespace; ttl?: number };

export class CloudflareKVCache implements CacheImpl {
  #kv: KVNamespace;
  defaultQueryTTL: number;

  constructor(options: CloudflareKVCacheOptions) {
    this.#kv = options.namespace;
    this.defaultQueryTTL = options.ttl ?? 60 * 1000;
  }

  // FIXME: Binding does not support bulk operations yet.
  async getAll(): Promise<Record<string, unknown>> {
    const keys = await this.#listAll();
    const values = await Promise.all(keys.map((key) => this.get(key)));
    return keys.reduce((acc, key, index) => ({ ...acc, [key]: values[index] }), {});
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.#kv.get(key);
    if (value === null) {
      return null;
    }

    return deserialize(value);
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.#kv.put(key, serialize(value), { expirationTtl: this.defaultQueryTTL });
  }

  async delete(key: string): Promise<void> {
    await this.#kv.delete(key);
  }

  // FIXME: Binding does not support bulk operations yet.
  async clear(): Promise<void> {
    const keys = await this.#listAll();
    for (const key in keys) {
      await this.#kv.delete(key);
    }
  }

  async #listAll(): Promise<string[]> {
    const getKeys = async (cursor?: string): Promise<{ keys: string[]; cursor?: string }> => {
      const result = await this.#kv.list({ cursor });
      const keys = result.keys.map((key) => key.name);
      const nextCursor = result.list_complete ? undefined : result.cursor;

      return { keys, cursor: nextCursor };
    };

    const { keys, cursor } = await getKeys();

    let currentCursor = cursor;
    while (currentCursor) {
      const { keys: nextKeys, cursor: nextCursor } = await getKeys(currentCursor);
      keys.push(...nextKeys);
      currentCursor = nextCursor;
    }

    return keys;
  }
}

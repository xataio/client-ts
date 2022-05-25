export interface CacheImpl {
  getAll(): Promise<Record<string, unknown>>;
  get: <T>(key: string) => Promise<T | null>;
  set: <T>(key: string, value: T) => Promise<void>;
  delete: (key: string) => Promise<void>;
  clear: () => Promise<void>;
}

export class NoCache implements CacheImpl {
  async getAll(): Promise<Record<string, unknown>> {
    return {};
  }

  async get<T>(): Promise<T | null> {
    return null;
  }

  async set(): Promise<void> {
    return;
  }

  async delete(): Promise<void> {
    return;
  }

  async clear(): Promise<void> {
    return;
  }
}

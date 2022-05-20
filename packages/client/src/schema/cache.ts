export interface CacheImpl {
  get: <T>(key: string) => Promise<T | null>;
  set: <T>(key: string, value: T) => Promise<void>;
  delete: (key: string) => Promise<void>;
  clear: () => Promise<void>;
}

export class NoCache implements CacheImpl {
  async get<T>(_key: string): Promise<T | null> {
    return null;
  }

  async set<T>(_key: string, _value: T): Promise<void> {
    return;
  }

  async delete(_key: string): Promise<void> {
    return;
  }

  async clear(): Promise<void> {
    return;
  }
}

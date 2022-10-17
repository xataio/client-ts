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

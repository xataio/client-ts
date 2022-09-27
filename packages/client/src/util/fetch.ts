import { FetchImpl } from '../api/fetcher';

export function getFetchImplementation(userFetch?: FetchImpl) {
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

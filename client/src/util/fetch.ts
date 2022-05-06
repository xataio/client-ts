import { FetchImpl } from '../api/fetcher';

export function getFetchImplementation(fetch?: FetchImpl) {
  const globalFetch = typeof fetch !== 'undefined' ? fetch : undefined;
  const fetchImpl = fetch ?? globalFetch;
  if (!fetchImpl) {
    /** @todo add a link after docs exist */
    throw new Error(
      `The \`fetch\` option passed to the Xata client is resolving to a falsy value and may not be correctly imported.`
    );
  }
  return fetchImpl;
}

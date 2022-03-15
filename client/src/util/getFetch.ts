type Options = {
  fetchesToTryToRequire: string[];
};

export const getFetch = (
  { fetchesToTryToRequire }: Options = { fetchesToTryToRequire: ['isomorphic-fetch', 'node-fetch', 'cross-fetch'] }
) => {
  if (typeof window === 'object' && 'fetch' in window) {
    return window.fetch;
  }

  if (typeof require !== 'function') {
    // If there's no `require`, bail out here. There is no hope.
    throw getFetchErrors.noImplementation;
  }

  for (const fetchImplementation of fetchesToTryToRequire) {
    try {
      return require(fetchImplementation);
    } catch {
      // Fail silently, throw later.
    }
  }

  throw getFetchErrors.noImplementation;
};

export const getFetchErrors = {
  noImplementation: new Error(`The Xata client has no fetcher configured. Please add one in its constructor.
    More in the docs: ` /** @todo add a link after docs exist */)
};

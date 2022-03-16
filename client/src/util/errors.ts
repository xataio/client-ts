export const errors = {
  noFetchImplementation:
    new Error(`The Xata client has no fetcher configured, and there is no global \`fetch\` function available for it to use. Please supply one in its constructor.
    
More in the docs: 
` /** @todo add a link after docs exist */)
};

import { getFetch, getFetchErrors } from './getFetch';

describe('getFetch', () => {
  it('should yield window.fetch when it exists', () => {
    // `any` party here because this is a test.
    const fakeFetch: any = () => new Promise((resolve) => resolve('hello'));
    global.window = { fetch: fakeFetch } as any;
    expect(getFetch()).toBe(fakeFetch);

    // @ts-ignore because lib.dom.d.ts does not apply here
    delete global.window;
  });
  it('should yield one fetch implementation when it exists (this project has cross-fetch)', () => {
    // We explicitly want to `require` here as an assertion, so disabling this rule:
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    expect(getFetch({ fetchesToTryToRequire: ['cross-fetch'] })).toEqual(require('cross-fetch'));
  });
  it("should throw when it can't find a suitable fetch", () => {
    expect(() => getFetch({ fetchesToTryToRequire: [] })).toThrow(getFetchErrors.noImplementation);
  });
});

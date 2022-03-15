export {};

declare global {
  namespace jest {
    interface Matchers<R> {
      toMatchWithoutWhitespace: (expected: string) => CustomMatcherResult;
    }
  }
}

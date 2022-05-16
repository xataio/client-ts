import { expect, test } from '@oclif/test';

describe('branches list', () => {
  test
    .stdout()
    .command(['branches:list'])
    .it('runs branches list', (ctx) => {
      expect(ctx.stdout).to.contain('hello world');
    });
});

import { test } from '@oclif/test';

describe('branches list', () => {
  test.command(['branches:list']).exit(2).it('Exits with error');
});

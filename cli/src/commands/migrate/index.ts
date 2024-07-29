import { BaseCommand } from '../../base.js';

export default class Migrate extends BaseCommand<typeof Migrate> {
  static description = 'Run and control multi-schema migrations with complete, rollback, start, list, status commands.';

  async run() {}
}

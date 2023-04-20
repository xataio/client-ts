import { BaseCommand } from '../../base.js';
import BranchList from '../branch/list.js';

export default class BranchesList extends BaseCommand<typeof BranchList> {
  static description = 'List branches';

  static examples = [];

  static flags = {
    ...this.commonFlags,
    ...this.databaseURLFlag
  };

  static args = {};

  static enableJsonFlag = true;

  static hidden = true;

  async run(): Promise<any> {
    this.warn('This command is deprecated. Please use `xata branch list` instead.');

    const { argv } = await this.parseCommand();
    return BranchList.run([...argv]);
  }
}

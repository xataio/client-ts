import { Flags } from '@oclif/core';
import { BaseCommand } from '../../base.js';
import Codegen from '../codegen/index.js';

export default class Init extends BaseCommand<typeof Init> {
  static description = 'Compile and upload xata workers';

  static flags = {
    ...this.databaseURLFlag,
    include: Flags.string({
      description: 'Include a glob pattern of files to compile'
    }),
    ignore: Flags.string({
      description: 'Exclude a glob pattern of files to compile'
    })
  };

  async run(): Promise<void> {
    if (this.projectConfig?.codegen && this.projectConfig?.codegen?.workersBuildId) {
      this.log('Workers already initialized');
      return;
    } else if (this.projectConfig?.codegen) {
      this.log(`Initializing workers configuration`);
      this.projectConfig.codegen.workersBuildId = '';
      await this.updateConfig();
      await Codegen.run([]);
      return;
    } else {
      this.warn(`Codegen is not configured, please run "xata init" again and enable codegen`);
    }
  }
}

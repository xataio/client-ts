import { Flags } from '@oclif/core';
import { BaseCommand } from '../../base.js';
import chokidar from 'chokidar';

export default class WorkersCompile extends BaseCommand {
  static description = 'Extract and compile xata workers';

  static flags = {
    watch: Flags.boolean({
      char: 'w',
      description: 'Watch for changes and recompile',
      default: false
    })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(WorkersCompile);

    const watcher = chokidar.watch('./**/*.ts', {
      ignored: [/(^|[/\\])\../, 'dist/*', 'node_modules/*']
    });

    watcher
      .on('add', (path) => this.#compile(path))
      .on('change', (path) => this.#compile(path))
      .on('ready', async () => {
        if (!flags.watch) await watcher.close();
      });
  }

  async #compile(file: string): Promise<void> {
    this.log(`Compiling ${file}`);
  }
}

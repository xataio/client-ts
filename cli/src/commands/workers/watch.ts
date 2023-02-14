import { Flags } from '@oclif/core';
import { Log, LogLevel, Miniflare } from 'miniflare';
import { BaseCommand } from '../../base.js';
import { buildWatcher, compileWorkers } from '../../workers.js';

export default class WorkersCompile extends BaseCommand<typeof WorkersCompile> {
  static description = 'Extract and compile xata workers';

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
    const { flags } = await this.parseCommand();
    // TODO: Allow customising port
    const watchPort = 64749;

    const { databaseURL } = await this.getDatabaseURL(flags.db);
    const { apiKey } = (await this.getProfile()) ?? {};

    buildWatcher({
      compile: async (path) => {
        return await compileWorkers(path);
      },
      run: async (results) => {
        const mounts = results.flat().map(({ name, modules, main }) => [
          name,
          {
            modules: true,
            script: modules.find(({ name }) => name === main)?.content ?? modules[0].content,
            bindings: {
              XATA_API_KEY: apiKey,
              XATA_DATABASE_URL: databaseURL
            },
            routes: [`http://localhost:${watchPort}/${name}`]
          }
        ]);

        const miniflare = new Miniflare({
          mounts: Object.fromEntries(mounts),
          scriptRequired: false,
          liveReload: true,
          log: new Log(LogLevel.DEBUG)
        });

        const server = await miniflare.createServer();

        try {
          server.listen(watchPort, () => {
            this.info(`Listening on port ${watchPort}`);
          });
        } catch (e) {
          console.error("Couldn't start server", e);
        }

        return () => {
          return new Promise((resolve) => {
            server.close(() => resolve());
          });
        };
      },
      included: flags.include?.split(','),
      ignored: flags.ignore?.split(',')
    });
  }
}

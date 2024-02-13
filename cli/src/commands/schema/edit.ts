import { PgRollOperationsDefinition } from '@xata.io/pgroll';
import chalk from 'chalk';
import { getEditor } from 'env-editor';
import { readFile, writeFile } from 'fs/promises';
import tmp from 'tmp';
import which from 'which';
import { BaseCommand } from '../../base.js';
import { getBranchDetailsWithPgRoll } from '../../migrations/pgroll.js';
import { reportBugURL } from '../../utils.js';
import Pull from '../pull/index.js';

const waitFlags: Record<string, string> = {
  code: '-w',
  'code-insiders': '-w',
  vscodium: '-w',
  sublime: '-w',
  textmate: '-w',
  atom: '--wait',
  webstorm: '--wait',
  intellij: '--wait',
  xcode: '-w'
};

export default class EditSchema extends BaseCommand<typeof EditSchema> {
  static description = 'Edit the schema of the current database';

  static examples = [];

  static flags = {
    ...this.databaseURLFlag,
    branch: this.branchFlag
  };

  static args = {};

  async run(): Promise<void> {
    const { flags } = await this.parseCommand();

    const { workspace, region, database, branch } = await this.getParsedDatabaseURLWithBranch(flags.db, flags.branch);

    const xata = await this.getXataClient();
    const branchDetails = await getBranchDetailsWithPgRoll(xata, { workspace, region, database, branch });
    if (!branchDetails) this.error('Could not get the schema from the current branch');

    const env = process.env.EDITOR || process.env.VISUAL;
    if (!env) {
      this.error(
        `Could not find an editor. Please set the environment variable ${chalk.bold('EDITOR')} or ${chalk.bold(
          'VISUAL'
        )}`
      );
    }

    const info = await getEditor(env);
    // This honors the env value. For `code-insiders` for example, we don't want `code` to be used instead.
    const binary = which.sync(env, { nothrow: true }) ? env : info.binary;

    const tmpobj = tmp.fileSync({ prefix: 'migration-', postfix: 'source.json' });
    await writeFile(
      tmpobj.name,
      JSON.stringify(
        {
          $schema: 'https://raw.githubusercontent.com/xataio/pgroll/main/schema.json',
          operations: []
        },
        null,
        2
      )
    );

    const waitFlag = waitFlags[info.id] || waitFlags[env];

    if (!info.isTerminalEditor && !waitFlag) {
      this.error(`The editor ${chalk.bold(env)} is a graphical editor that is not supported.`, {
        suggestions: [
          `Set the ${chalk.bold('EDITOR')} or ${chalk.bold('VISUAL')} variables to a different editor`,
          `Open an issue at ${reportBugURL(`Support \`${info.binary}\` editor for schema editing`)}`
        ]
      });
    }

    const args = [waitFlag, tmpobj.name].filter(Boolean);
    await this.runCommand(binary, args);

    const fileContents = await readFile(tmpobj.name, 'utf8');
    try {
      const { operations } = JSON.parse(fileContents);
      const result = PgRollOperationsDefinition.safeParse(operations);
      if (!result.success) {
        this.printZodError(result.error);
        this.error('The schema is not valid. See the errors above');
      }

      await xata.api.branch.applyMigration({
        pathParams: { workspace, region, dbBranchName: `${database}:${branch}` },
        body: { operations }
      });

      // Run pull to retrieve remote migrations
      await Pull.run([branch]);
    } catch (e) {
      this.error('Unable to parse the schema file. Please make sure it is a valid JSON file');
    }
  }
}

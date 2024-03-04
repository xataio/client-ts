import { Flags } from '@oclif/core';
import { getHostUrl, XataApiClient } from '@xata.io/client';
import { generate } from '@xata.io/codegen';
import chalk from 'chalk';
import EventEmitter from 'events';
import { createWriteStream } from 'fs';
import fs, { mkdir } from 'fs/promises';
import fetch from 'node-fetch';
import { homedir, tmpdir } from 'os';
import path, { dirname } from 'path';
import RJSON from 'relaxed-json';
import repl from 'repl';
import { fileURLToPath } from 'url';
import util from 'util';
import { BaseCommand } from '../../base.js';
import { getBranchDetailsWithPgRoll } from '../../migrations/pgroll.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default class Shell extends BaseCommand<typeof Shell> {
  static description = 'Open a shell to the current database and branch';

  static flags = {
    ...this.commonFlags,
    ...this.databaseURLFlag,
    branch: this.branchFlag,
    code: Flags.string({
      char: 'c',
      description: 'Fragment of code to be executed in the shell immediately after starting it'
    })
  };

  async run(): Promise<void> {
    const { flags } = await this.parseCommand();
    const profile = await this.getProfile();
    const apiKey = profile?.apiKey;
    if (!apiKey) {
      this.error('No API key found. Either use the XATA_API_KEY environment variable or run `xata auth login`');
    }
    const { protocol, host, databaseURL, workspace, region, database, branch } =
      await this.getParsedDatabaseURLWithBranch(flags.db, flags.branch);

    // Generate the file in the same dir than this package's code so it
    // can import @xata.io/client
    const tempFile = path.join(__dirname, `xata-${Date.now()}.mjs`);
    try {
      const xata = await this.getXataClient();
      const branchDetails = await getBranchDetailsWithPgRoll(xata, { workspace, region, database, branch });
      const { schema } = branchDetails;

      const { javascript } = await generate({ language: 'javascript', schema });
      await fs.writeFile(tempFile, javascript);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(message);
    }

    this.log(
      `Connected to ${chalk.bold(databaseURL)}. There's a XataClient instance in the ${chalk.bold(
        'xata'
      )} global variable.`
    );

    const fetchApi = async (method: string, path: string, body?: any) => {
      const mainHost = getHostUrl(profile.host, 'main');
      const baseUrl = path.startsWith('/db') ? `${protocol}//${host}` : mainHost;

      const parse = () => {
        try {
          return JSON.stringify(RJSON.parse(body));
        } catch (error) {
          return undefined;
        }
      };

      try {
        const response = await fetch(`${baseUrl}${path}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: parse()
        });

        return response.json();
      } catch (err) {
        return err;
      }
    };

    const defaultEval = getDefaultEval();
    const replServer = repl.start({
      preview: true,
      eval(evalCmd, context, file, callback) {
        try {
          const table = evalCmd.endsWith('\\t\n');
          if (table) {
            evalCmd = evalCmd.substring(0, evalCmd.length - 3);
          }

          const [verb, path, ...rest] = evalCmd.split(' ');
          if (['get', 'post', 'patch', 'put', 'delete'].includes(verb.toLowerCase())) {
            const body = rest.join(' ');
            return fetchApi(verb, path, body).then((result) => {
              return postProcess(result, { table, deep: true }, callback);
            });
          }

          defaultEval.bind(replServer)(evalCmd, context, file, function (err, result) {
            if (err) return callback(err, null);
            if (result && typeof result === 'object' && typeof result.then === 'function') {
              result.then((res: unknown) => postProcess(res, { table }, callback)).catch(callback);
            } else {
              postProcess(result, { table }, callback);
            }
          });
        } catch (err) {
          const e = err instanceof Error ? err : new Error(String(err));
          callback(e, null);
        }
      }
    });

    const { XataClient } = await import(tempFile);
    await fs.unlink(tempFile);

    replServer.context.xata = new XataClient({ fetch, apiKey, host: profile.host, clientName: 'cli-shell' });
    replServer.context.api = new XataApiClient({ fetch, apiKey, clientName: 'cli-shell' });
    replServer.context.api.GET = (path: string) => fetchApi('GET', path);
    replServer.context.api.POST = (path: string, body?: any) => fetchApi('POST', path, JSON.stringify(body));
    replServer.context.api.PATCH = (path: string, body?: any) => fetchApi('PATCH', path, JSON.stringify(body));
    replServer.context.api.PUT = (path: string, body?: any) => fetchApi('PUT', path, JSON.stringify(body));
    replServer.context.api.DELETE = (path: string) => fetchApi('DELETE', path);

    await setupHistory(replServer);

    if (flags.code) {
      replServer.write(`${flags.code}\n`);
    }
  }
}

// This is a hacky way I found to get the defaultEval
// from Node.js source code https://github.com/nodejs/node/blob/master/lib/repl.js#L409-L640
function getDefaultEval() {
  const input = new EventEmitter() as any;
  input.resume = function () {
    /* empty */
  };
  input.pause = function () {
    /* empty */
  };

  // Maybe we coan use an in-memory implementation of a write stream
  const output = createWriteStream(path.join(tmpdir(), `output-${Date.now()}`));

  const replServer = repl.start({ input, output });
  const defaultEval = replServer.eval;
  replServer.pause();
  return defaultEval;
}

function postProcess(
  result: any,
  options: { table: boolean; deep?: boolean },
  callback: (err: Error | null, result: any) => void
) {
  const { table } = options;
  return callback(
    null,
    table
      ? console.table(result)
      : typeof result === 'object' && options.deep
      ? console.log(util.inspect(result, { showHidden: false, depth: null, colors: true }))
      : result
  );
}

async function setupHistory(replServer: repl.REPLServer) {
  try {
    const configDir = path.join(homedir(), '.config', 'xata-shell');
    await mkdir(configDir, { recursive: true });
    process.env.NODE_REPL_HISTORY = path.join(configDir, 'history');
    await new Promise((resolve, reject) => {
      replServer.setupHistory(path.join(configDir, 'history'), function (err) {
        if (err) return reject(err);
        resolve(undefined);
      });
    });
  } catch (err) {
    // Ignore. It's ok not to have a history file
  }
}

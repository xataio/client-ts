import { Flags } from '@oclif/core';
import { XataApiClient } from '@xata.io/client';
import { generateFromContext } from '@xata.io/codegen';
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
import { BaseCommand } from '../../base.js';
import { getProfile } from '../../credentials.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default class Shell extends BaseCommand {
  static description = 'Open a shell to the current database and branch';

  static flags = {
    ...this.commonFlags,
    databaseURL: this.databaseURLFlag,
    branch: this.branchFlag,
    code: Flags.string({
      description: 'Fragment of code to be executed in the shell immediately after starting it'
    })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Shell);
    const apiKey = (await getProfile())?.apiKey;
    if (!apiKey)
      this.error('No API key found. Either use the XATA_API_KEY environment variable or run `xata auth login`');
    const { protocol, host, databaseURL } = await this.getParsedDatabaseURLWithBranch(flags.databaseURL, flags.branch);

    // Generate the file in the same dir than this package's code so it
    // can import @xata.io/client
    const tempFile = path.join(__dirname, `xata-${Date.now()}.mjs`);
    try {
      const { transpiled } = await generateFromContext('javascript', { apiKey, databaseURL });
      await fs.writeFile(tempFile, transpiled);
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
      // TODO: Add support for staging, how?
      const baseUrl = path.startsWith('/db') ? `${protocol}//${host}` : 'https://api.xata.io';

      try {
        const response = await fetch(`${baseUrl}${path}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: body ? JSON.stringify(RJSON.parse(body)) : undefined
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
              return postProcess(result, { table }, callback);
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

    replServer.context.xata = new XataClient({ fetch, apiKey });
    replServer.context.api = new XataApiClient({ fetch, apiKey });

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

function postProcess(result: any, options: { table: boolean }, callback: (err: Error | null, result: any) => void) {
  const { table } = options;
  return callback(null, table ? console.table(result) : result);
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

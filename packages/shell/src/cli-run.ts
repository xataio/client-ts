import { getDatabaseURL } from '@xata.io/client';
import { generateFromContext } from '@xata.io/codegen';
import chalk from 'chalk';
import fetch from 'cross-fetch';
import dotenv from 'dotenv';
import { EventEmitter } from 'events';
import { createWriteStream } from 'fs';
import fs, { mkdir } from 'fs/promises';
import ora from 'ora';
import { homedir, tmpdir } from 'os';
import path, { dirname } from 'path';
import repl from 'repl';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function run(options: { env?: string; databaseURL?: string; apiKey?: string; code?: string }) {
  const spinner = ora();
  spinner.start('Downloading schema and generating client');
  dotenv.config({ path: options.env || '.env' });

  const databaseURL = options.databaseURL || getDatabaseURL();

  // Generate the file in the same dir than this package's code so it
  // can import @xata.io/client
  const tempFile = path.join(__dirname, `xata-${Date.now()}.mjs`);
  try {
    const { transpiled } = await generateFromContext('javascript', { ...options, databaseURL });
    await fs.writeFile(tempFile, transpiled);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    spinner.fail(message);
    process.exit(1);
  }

  spinner.info(
    `Connected to ${chalk.bold(databaseURL)}. There's a XataClient instance in the ${chalk.bold(
      'xata'
    )} global variable.`
  );

  const defaultEval = getDefaultEval();
  const replServer = repl.start({
    preview: true,
    eval(evalCmd, context, file, callback) {
      try {
        const table = evalCmd.endsWith('\\t\n');
        if (evalCmd.endsWith('\\t\n')) {
          evalCmd = evalCmd.substring(0, evalCmd.length - 3);
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

  replServer.context.xata = new XataClient({ fetch });

  await setupHistory(replServer);

  if (options.code) {
    replServer.write(`${options.code}\n`);
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

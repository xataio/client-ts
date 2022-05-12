import { generateClient } from '@xata.io/codegen';
import fetch from 'cross-fetch';
import dotenv from 'dotenv';
import { EventEmitter } from 'events';
import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import repl from 'repl';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function run(options: { env?: string }) {
  dotenv.config({ path: options.env || '.env' });

  // Generate the file in the same dir than this package's code so it
  // can import @xata.io/client
  const tempFile = path.join(__dirname, `xata-${Date.now()}.mjs`);
  await generateClient(tempFile);

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
            result.then((res: any) => postProcess(res, { table }, callback)).catch(callback);
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

import { generateClient } from '@xata.io/codegen';
import fetch from 'cross-fetch';
import dotenv from 'dotenv';
import { EventEmitter } from 'events';
import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import repl from 'repl';

export async function run() {
  dotenv.config();
  // TODO: do not generate in the current dir
  const tempFile = path.join(process.cwd(), `xata-${Date.now()}.js`);
  const tempFile2 = tempFile.replace('.js', '.mjs');
  await generateClient(tempFile);
  await fs.rename(tempFile, tempFile2);

  const defaultEval = getDefaultEval();

  const replServer = repl.start({
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

  const { XataClient } = await import(tempFile2);
  await fs.unlink(tempFile2);

  replServer.context.xata = new XataClient({ fetch });
}

function getDefaultEval() {
  const input = new EventEmitter();
  (input as any).resume = function () {
    /* empty */
  };
  (input as any).pause = function () {
    /* empty */
  };

  const replServer = repl.start({
    input: input as any,
    output: createWriteStream(path.join(tmpdir(), `output-${Date.now()}`))
  });
  const defaultEval = replServer.eval;
  replServer.pause();
  return defaultEval;
}

function postProcess(result: any, options: { table: boolean }, callback: (err: Error | null, result: any) => void) {
  const { table } = options;
  return callback(null, table ? console.table(result) : result);
}

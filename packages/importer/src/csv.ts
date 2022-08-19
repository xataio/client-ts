import csv from 'csvtojson';
import { Converter } from 'csvtojson/v2/Converter';
import internal from 'stream';
import { ParseOptions } from './index';

export async function parseString(text: string, options: ParseOptions) {
  return process(initConverter(options).fromString(text), options);
}

export async function parseFile(file: string, options: ParseOptions) {
  return process(initConverter(options).fromFile(file), options);
}

export async function parseStream(stream: internal.Readable, options: ParseOptions) {
  return process(initConverter(options).fromStream(stream), options);
}

function initConverter({ noheader }: ParseOptions) {
  return csv({ output: 'csv', noheader });
}

function process(converter: Converter, { callback, batchSize = 1000, columns, maxRows }: ParseOptions) {
  let rows = 0;
  // Even after calling converter.end() it seems that csvtojson reads one or two lines more.
  // We want to avoid that.
  let stopped = false;
  return new Promise((resolve, reject) => {
    let lines: string[][] = [];
    converter.on('header', (header) => {
      if (!columns) columns = header;
    });
    converter.subscribe(
      async (line) => {
        if (stopped) return;

        lines.push(line);
        if (lines.length >= batchSize) {
          const stop = await callback(lines, columns, rows);
          if (stop) {
            stopped = true;
            converter.end();
            return;
          }

          lines = [];
        }
        rows++;
        if (maxRows && rows > maxRows) {
          converter.end();
        }
      },
      reject,
      () => {
        if (stopped) return;
        const p = lines.length > 0 ? callback(lines, columns, rows) : Promise.resolve();
        p.then(resolve).catch(reject);
      }
    );
  });
}

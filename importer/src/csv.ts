import csv from 'csvtojson';
import { Converter } from 'csvtojson/v2/Converter';
import internal from 'stream';
import { ParseOptions } from './index.js';

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

function process(converter: Converter, { callback, batchSize = 100, columns }: ParseOptions) {
  return new Promise((resolve, reject) => {
    let lines: Record<string, unknown>[] = [];
    converter.on('header', (header) => {
      if (!columns) columns = header;
    });
    converter.subscribe(
      (line) => {
        lines.push(line);
        if (lines.length >= batchSize) {
          const p = callback(lines, columns);
          lines = [];
          return p;
        }
      },
      reject,
      () => {
        const p = lines.length > 0 ? callback(lines, columns) : Promise.resolve();
        p.then(resolve);
      }
    );
  });
}

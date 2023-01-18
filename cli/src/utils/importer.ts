import { Flags } from '@oclif/core';

export function csvFlags(prefix = '') {
  const flags = {
    delimiter: Flags.string({
      description: 'The delimiter to use for parsing CSV data',
      options: ['auto', ',', ';', '|', '\t']
    }),
    header: Flags.boolean({
      description: 'Whether the CSV data has a header row'
    }),
    skipEmptyLines: Flags.boolean({
      description: 'Whether to skip empty lines in the CSV data'
    }),
    nullValues: Flags.string({
      description: 'The values to interpret as null',
      multiple: true
    }),
    quoteChar: Flags.string({
      description: 'The character to use for quoting fields'
    }),
    escapeChar: Flags.string({
      description: 'The character to use for escaping the quote character within a field'
    }),
    newline: Flags.string({
      description: 'The newline sequence to use for parsing CSV data',
      options: ['\r', '\n', '\r\n']
    }),
    commentPrefix: Flags.string({
      description: 'The prefix to use for comments'
    })
  };

  return Object.fromEntries(Object.entries(flags).map(([name, flag]) => [`${prefix}${name}`, flag]));
}

export function commonImportFlags() {
  return {
    encoding: Flags.string({
      description: 'Encoding of the CSV file',
      default: 'utf8' as const
    })
  };
}

import { buildClient } from '@xata.io/client';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { join } from 'path';
import { Readable } from 'stream';
import { describe, expect, test } from 'vitest';
import { XataImportPlugin } from '../src/plugin';
import { CsvResults, ParseCsvOptions, ParseResults } from '../src/types';

// Get environment variables before reading them
dotenv.config({ path: join(process.cwd(), '.env') });

const XataClient = buildClient({
  import: new XataImportPlugin()
});

const xata = new XataClient({ fetch, apiKey: 'xau_test123', databaseURL: 'https://something.com' });

const stringToStream = (str: string) => {
  const stream = new Readable();
  stream.push(str);
  stream.push(null);
  return stream;
};

const defaultMeta = { delimiter: ',', estimatedProgress: 1, linebreak: '\n' };

describe('parseCsvStream', () => {
  const testCases: { name: string; fileContents: string; options?: ParseCsvOptions; expected: CsvResults }[] = [
    {
      name: 'empty',
      fileContents: '',
      expected: {
        results: {
          success: true,
          columns: [],
          warnings: ["Unable to auto-detect delimiting character; defaulted to ','"],
          data: []
        },
        meta: {
          ...defaultMeta,
          fields: []
        }
      }
    },
    {
      name: 'simple',
      fileContents: 'name\nXata',
      expected: {
        results: {
          success: true,
          columns: [{ name: 'name', type: 'string' }],
          warnings: ["Unable to auto-detect delimiting character; defaulted to ','"],
          data: [{ name: 'Xata' }]
        },
        meta: {
          ...defaultMeta,
          fields: ['name']
        }
      }
    },
    {
      name: 'simple with schema',
      fileContents: 'name\nXata',
      options: { columns: [{ name: 'name', type: 'text' }] },
      expected: {
        results: {
          success: true,
          columns: [{ name: 'name', type: 'text' }],
          warnings: ["Unable to auto-detect delimiting character; defaulted to ','"],
          data: [{ name: 'Xata' }]
        },
        meta: {
          ...defaultMeta,
          fields: ['name']
        }
      }
    },
    {
      name: 'multiple',
      fileContents: 'name,dob\nXata,2019-01-01',
      expected: {
        results: {
          success: true,
          columns: [
            { name: 'name', type: 'string' },
            { name: 'dob', type: 'datetime' }
          ],
          warnings: [],
          data: [{ name: 'Xata', dob: new Date('2019-01-01T00:00:00.000Z') }]
        },
        meta: {
          ...defaultMeta,
          fields: ['name', 'dob']
        }
      }
    },
    {
      name: 'booleans',
      fileContents: 'boolean_1\nT\nF',
      expected: {
        results: {
          success: true,
          columns: [{ name: 'boolean_1', type: 'bool' }],
          warnings: ["Unable to auto-detect delimiting character; defaulted to ','"],
          data: [{ boolean_1: true }, { boolean_1: false }]
        },
        meta: {
          ...defaultMeta,
          fields: ['boolean_1']
        }
      }
    },
    {
      name: 'booleans custom',
      fileContents: 'boolean\nYep\nNope',
      options: { booleanValues: { true: ['Yep'], false: ['Nope'] } },
      expected: {
        results: {
          success: true,
          columns: [{ name: 'boolean', type: 'bool' }],
          warnings: ["Unable to auto-detect delimiting character; defaulted to ','"],
          data: [{ boolean: true }, { boolean: false }]
        },
        meta: {
          ...defaultMeta,
          fields: ['boolean']
        }
      }
    },
    {
      name: 'booleans as string',
      fileContents: 'boolean_1\nT\nF',
      options: { columns: [{ name: 'boolean_1', type: 'string' }] },
      expected: {
        results: {
          success: true,
          columns: [{ name: 'boolean_1', type: 'string' }],
          warnings: ["Unable to auto-detect delimiting character; defaulted to ','"],
          data: [{ boolean_1: 'T' }, { boolean_1: 'F' }]
        },
        meta: {
          ...defaultMeta,
          fields: ['boolean_1']
        }
      }
    },
    {
      name: 'semicolon delimited',
      fileContents: 'boolean_1;string_1\nT;something\nF;else',
      expected: {
        results: {
          success: true,
          columns: [
            { name: 'boolean_1', type: 'bool' },
            { name: 'string_1', type: 'string' }
          ],
          warnings: [],
          data: [
            { boolean_1: true, string_1: 'something' },
            { boolean_1: false, string_1: 'else' }
          ]
        },
        meta: {
          ...defaultMeta,
          delimiter: ';',
          fields: ['boolean_1', 'string_1']
        }
      }
    },
    {
      name: '\\r\\n linebreaks',
      fileContents: 'boolean_1,string_1\r\nT,something\r\nF,else',
      expected: {
        results: {
          success: true,
          columns: [
            { name: 'boolean_1', type: 'bool' },
            { name: 'string_1', type: 'string' }
          ],
          warnings: [],
          data: [
            { boolean_1: true, string_1: 'something' },
            { boolean_1: false, string_1: 'else' }
          ]
        },
        meta: {
          ...defaultMeta,
          linebreak: '\r\n',
          fields: ['boolean_1', 'string_1']
        }
      }
    },
    {
      name: 'no header',
      fileContents: 'T,something\nF,else',
      options: { header: false },
      expected: {
        results: {
          success: true,
          columns: [
            { name: '0', type: 'bool' },
            { name: '1', type: 'string' }
          ],
          warnings: [],
          data: [
            { 0: true, 1: 'something' },
            { 0: false, 1: 'else' }
          ]
        },
        meta: {
          ...defaultMeta,
          fields: undefined
        }
      }
    },
    {
      name: 'skips empty lines',
      fileContents: 'boolean_1\nT\n\n\nF\n\n\n\n',
      expected: {
        results: {
          success: true,
          columns: [{ name: 'boolean_1', type: 'bool' }],
          warnings: ["Unable to auto-detect delimiting character; defaulted to ','"],
          data: [{ boolean_1: true }, { boolean_1: false }]
        },
        meta: {
          ...defaultMeta,
          fields: ['boolean_1']
        }
      }
    },
    {
      name: 'does not skips empty lines',
      fileContents: 'boolean_1\nT\n\nF\n',
      options: { skipEmptyLines: false },
      expected: {
        results: {
          success: true,
          columns: [{ name: 'boolean_1', type: 'bool' }],
          warnings: ["Unable to auto-detect delimiting character; defaulted to ','"],
          data: [{ boolean_1: true }, { boolean_1: null }, { boolean_1: false }]
        },
        meta: {
          ...defaultMeta,
          fields: ['boolean_1']
        }
      }
    },
    {
      name: 'with quotes',
      fileContents: '"boolean_1","string_1"\n"T","something"\n"F","else"',
      expected: {
        results: {
          success: true,
          columns: [
            { name: 'boolean_1', type: 'bool' },
            { name: 'string_1', type: 'string' }
          ],
          warnings: [],
          data: [
            { boolean_1: true, string_1: 'something' },
            { boolean_1: false, string_1: 'else' }
          ]
        },
        meta: {
          ...defaultMeta,
          fields: ['boolean_1', 'string_1']
        }
      }
    },
    {
      name: 'escape quotes',
      fileContents: '"boolean_1","string_1"\n"T","something"""\n"F","""else"',
      expected: {
        results: {
          success: true,
          columns: [
            { name: 'boolean_1', type: 'bool' },
            { name: 'string_1', type: 'string' }
          ],
          warnings: [],
          data: [
            { boolean_1: true, string_1: 'something"' },
            { boolean_1: false, string_1: '"else' }
          ]
        },
        meta: {
          ...defaultMeta,
          fields: ['boolean_1', 'string_1']
        }
      }
    },
    {
      name: 'with limit',
      fileContents: '"boolean_1","string_1"\n"T","something"\n"F","else"',
      options: { limit: 1 },
      expected: {
        results: {
          success: true,
          columns: [
            { name: 'boolean_1', type: 'bool' },
            { name: 'string_1', type: 'string' }
          ],
          warnings: [],
          data: [{ boolean_1: true, string_1: 'something' }]
        },
        meta: {
          ...defaultMeta,
          fields: ['boolean_1', 'string_1']
        }
      }
    },
    {
      name: 'null values',
      fileContents: '"boolean_1","string_1"\n"T","null"\n"F","else"',
      expected: {
        results: {
          success: true,
          columns: [
            { name: 'boolean_1', type: 'bool' },
            { name: 'string_1', type: 'string' }
          ],
          warnings: [],
          data: [
            { boolean_1: true, string_1: null },
            { boolean_1: false, string_1: 'else' }
          ]
        },
        meta: {
          ...defaultMeta,
          fields: ['boolean_1', 'string_1']
        }
      }
    },
    {
      name: 'custom null values',
      fileContents: '"boolean_1","string_1"\n"T","nil"\n"F","null"',
      options: { isNull: (value) => value === 'nil' },
      expected: {
        results: {
          success: true,
          columns: [
            { name: 'boolean_1', type: 'bool' },
            { name: 'string_1', type: 'string' }
          ],
          warnings: [],
          data: [
            { boolean_1: true, string_1: null },
            { boolean_1: false, string_1: 'null' }
          ]
        },
        meta: {
          ...defaultMeta,
          fields: ['boolean_1', 'string_1']
        }
      }
    },
    {
      name: 'ignores columns',
      fileContents: '"boolean_1","string_1"\n"T","something"\n"F","else"',
      options: { columns: [{ name: 'boolean_1', type: 'bool' }] },
      expected: {
        results: {
          success: true,
          columns: [{ name: 'boolean_1', type: 'bool' }],
          warnings: [],
          data: [{ boolean_1: true }, { boolean_1: false }]
        },
        meta: {
          ...defaultMeta,
          fields: ['boolean_1', 'string_1']
        }
      }
    },
    {
      name: 'warns for malformed data',
      fileContents: '"boolean_1,"string_1"\n"T","something"\n"F","else"',
      options: { columns: [{ name: 'boolean_1', type: 'bool' }] },
      expected: {
        results: {
          success: true,
          columns: [{ name: 'boolean_1', type: 'bool' }],
          warnings: [
            'Trailing quote on quoted field is malformed',
            "Unable to auto-detect delimiting character; defaulted to ','",
            'Too many fields: expected 1 fields but parsed 2',
            'Too many fields: expected 1 fields but parsed 2'
          ],
          data: [{ boolean_1: null }, { boolean_1: null }]
        },
        meta: {
          ...defaultMeta,
          fields: ['boolean_1,"string_1']
        }
      }
    }
  ];
  for (const { name, fileContents, options, expected } of testCases) {
    test(name, async () => {
      const result = await xata.import.parseCsvStream({
        fileStream: stringToStream(fileContents),
        parserOptions: options ?? {}
      });
      expect(result).toEqual(expected);
    });
  }
});

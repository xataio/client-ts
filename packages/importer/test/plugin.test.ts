import { buildClient } from '@xata.io/client';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { join } from 'path';
import { expect, test, describe } from 'vitest';
import { XataImportPlugin } from '../src/plugin';
import { ParseCsvOptions, ParseJsonOptions, ParseResults } from '../src/types';

// Get environment variables before reading them
dotenv.config({ path: join(process.cwd(), '.env') });

const XataClient = buildClient({
  import: new XataImportPlugin()
});

const xata = new XataClient({ fetch, apiKey: 'xau_test123', databaseURL: 'https://something.com' });

describe('@xata.io/importer plugin', () => {
  test('plugin has correct functions', () => {
    expect(xata.import).toBeDefined();
    expect(xata.import.parseCsv).toBeDefined();
    expect(xata.import.parseJson).toBeInstanceOf(Function);
    expect(xata.import.parseNdJson).toBeInstanceOf(Function);
    expect(xata.import.parseCsvFileStream).toBeInstanceOf(Function);
    expect(xata.import.importStream).toBeInstanceOf(Function);
  });

  describe('parseJson', () => {
    const testCases: { name: string; input: ParseJsonOptions; expected: ParseResults }[] = [
      {
        name: 'empty',
        input: { data: [] },
        expected: { success: true, columns: [], warnings: [], data: [] }
      },
      {
        name: 'simple',
        input: { data: [{ name: 'Xata' }] },
        expected: {
          success: true,
          columns: [{ name: 'name', type: 'string' }],
          warnings: [],
          data: [{ name: 'Xata' }]
        }
      },
      {
        name: 'simple object',
        input: { data: { name: 'Xata' } },
        expected: {
          success: true,
          columns: [{ name: 'name', type: 'string' }],
          warnings: [],
          data: [{ name: 'Xata' }]
        }
      },
      {
        name: 'simple JSON string',
        input: { data: JSON.stringify([{ name: 'Xata' }]) },
        expected: {
          success: true,
          columns: [{ name: 'name', type: 'string' }],
          warnings: [],
          data: [{ name: 'Xata' }]
        }
      },
      {
        name: 'simple with schema',
        input: { data: [{ name: 'Xata' }], columns: [{ name: 'name', type: 'text' }] },
        expected: {
          success: true,
          columns: [{ name: 'name', type: 'text' }],
          warnings: [],
          data: [{ name: 'Xata' }]
        }
      },
      {
        name: 'multiple',
        input: { data: [{ name: 'Xata', dob: '2019-01-01' }] },
        expected: {
          success: true,
          columns: [
            { name: 'name', type: 'string' },
            { name: 'dob', type: 'datetime' }
          ],
          warnings: [],
          data: [{ name: 'Xata', dob: new Date('2019-01-01T00:00:00.000Z') }]
        }
      }
    ];

    testCases.forEach(({ name, input, expected }) => {
      test(name, () => {
        const result = xata.import.parseJson(input);
        expect(result).toEqual(expected);
      });
    });
    test('errors for invalid json', () => {
      expect(() => xata.import.parseJson({ data: '{asadasd,}' })).toThrowError('JSON5: invalid character');
    });
  });

  describe('parseCsv', () => {
    const testCases: { name: string; input: ParseCsvOptions; expected: ParseResults }[] = [
      {
        name: 'empty',
        input: { data: '' },
        expected: {
          success: true,
          columns: [],
          warnings: ["Unable to auto-detect delimiting character; defaulted to ','"],
          data: []
        }
      },
      {
        name: 'simple',
        input: { data: 'name\nXata' },
        expected: {
          success: true,
          columns: [{ name: 'name', type: 'string' }],
          warnings: ["Unable to auto-detect delimiting character; defaulted to ','"],
          data: [{ name: 'Xata' }]
        }
      },
      {
        name: 'simple with schema',
        input: { data: 'name\nXata', columns: [{ name: 'name', type: 'text' }] },
        expected: {
          success: true,
          columns: [{ name: 'name', type: 'text' }],
          warnings: ["Unable to auto-detect delimiting character; defaulted to ','"],
          data: [{ name: 'Xata' }]
        }
      },
      {
        name: 'multiple',
        input: { data: 'name,dob\nXata,2019-01-01' },
        expected: {
          success: true,
          columns: [
            { name: 'name', type: 'string' },
            { name: 'dob', type: 'datetime' }
          ],
          warnings: [],
          data: [{ name: 'Xata', dob: new Date('2019-01-01T00:00:00.000Z') }]
        }
      }
    ];

    testCases.forEach(({ name, input, expected }) => {
      test(name, () => {
        const result = xata.import.parseCsv(input);
        expect(result).toEqual(expected);
      });
    });
  });
});

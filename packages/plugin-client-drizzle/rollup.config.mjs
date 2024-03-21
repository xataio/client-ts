import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';

export default [
  {
    input: 'src/index.ts',
    plugins: [esbuild()],
    output: [
      {
        file: `dist/index.cjs`,
        format: 'cjs',
        sourcemap: true
      },
      {
        file: `dist/index.mjs`,
        format: 'es',
        sourcemap: true
      }
    ]
  },
  {
    input: 'src/index.ts',
    plugins: [dts()],
    output: {
      file: `dist/index.d.ts`,
      format: 'es'
    }
  },
  {
    input: 'src/pg/index.ts',
    plugins: [esbuild()],
    output: [
      {
        file: `dist/pg.cjs`,
        format: 'cjs',
        sourcemap: true
      },
      {
        file: `dist/pg.mjs`,
        format: 'es',
        sourcemap: true
      }
    ]
  },
  {
    input: 'src/pg/index.ts',
    plugins: [dts()],
    output: {
      file: `dist/pg.d.ts`,
      format: 'es'
    }
  },
];

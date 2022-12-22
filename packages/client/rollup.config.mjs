import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';
import stripCode from 'rollup-plugin-strip-code';

export default [
  {
    input: 'src/index.ts',
    plugins: [
      stripCode({
        start_comment: 'REMOVE_CJS_BUNDLE_START',
        end_comment: 'REMOVE_CJS_BUNDLE_END'
      }),
      esbuild()
    ],
    output: {
      file: `dist/index.cjs`,
      format: 'cjs',
      sourcemap: true
    }
  },
  {
    input: 'src/index.ts',
    plugins: [
      stripCode({
        start_comment: 'REMOVE_ESM_BUNDLE_START',
        end_comment: 'REMOVE_ESM_BUNDLE_END'
      }),
      esbuild()
    ],
    output: {
      file: `dist/index.mjs`,
      format: 'es',
      sourcemap: true
    }
  },
  {
    input: 'src/index.ts',
    plugins: [dts()],
    output: {
      file: `dist/index.d.ts`,
      format: 'es'
    }
  }
];

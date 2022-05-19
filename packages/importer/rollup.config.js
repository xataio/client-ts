import autoExternal from 'rollup-plugin-auto-external';
import dts from 'rollup-plugin-dts';
import esbuild from 'rollup-plugin-esbuild';
import builtins from 'rollup-plugin-node-builtins';
import shebang from 'rollup-plugin-preserve-shebang';
import globals from 'rollup-plugin-node-globals';

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
    input: 'src/cli.ts',
    output: {
      file: 'dist/cli.js',
      format: 'es',
      banner: '#!/usr/bin/env node'
    },
    plugins: [shebang(), globals(), builtins(), esbuild(), autoExternal()]
  }
];

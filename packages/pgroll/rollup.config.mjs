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
    input: 'src/mcp.ts',
    plugins: [esbuild()],
    output: [
      {
        file: `dist/mcp.cjs`,
        format: 'cjs',
        sourcemap: true
      },
      {
        file: `dist/mcp.mjs`,
        format: 'es',
        sourcemap: true
      }
    ]
  }
];

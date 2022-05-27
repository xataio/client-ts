import { EdgeRuntime } from 'edge-runtime';
import { rollup } from 'rollup';
import typescript from 'rollup-plugin-typescript2';
import { isObject } from '../shared';

async function main() {
  const runtime = new EdgeRuntime({
    extend: (context) => {
      context.XATA_API_KEY = process.env.XATA_API_KEY;
      context.XATA_WORKSPACE = process.env.XATA_WORKSPACE;
      return context;
    }
  });

  try {
    const bundle = await rollup({
      input: `${__dirname}/test.ts`,
      output: { file: `file://bundle.js`, format: 'es' },
      plugins: [
        typescript({
          tsconfigOverride: { compilerOptions: { module: 'esnext', target: 'ES6', lib: ['dom', 'esnext'] } }
        })
      ]
    });

    const { output } = await bundle.generate({});
    const code = output[0].code;

    const result = await runtime.evaluate(code);

    if (
      isObject(result) &&
      Array.isArray(result.users) &&
      Array.isArray(result.teams) &&
      result.users.length > 0 &&
      result.teams.length > 0
    ) {
      console.log('Successfully executed code in edge runtime');
    } else {
      throw new Error('Failed to execute code in edge runtime');
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();

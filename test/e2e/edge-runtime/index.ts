import { execSync } from 'child_process';
import fetch from 'cross-fetch';
import { EdgeRuntime } from 'edge-runtime';
import { rollup } from 'rollup';
import { importCdn } from 'rollup-plugin-import-cdn';
import typescript from 'rollup-plugin-typescript2';
import { isObject } from '../shared';

async function main() {
  // Install client
  execSync(`npm install @xata.io/client@${process.env.VERSION_TAG} --no-save`);

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
      output: { file: `file://bundle.js` },
      plugins: [
        typescript({
          tsconfigOverride: { compilerOptions: { module: 'esnext', target: 'ES6', lib: ['dom', 'esnext'] } }
        }),
        importCdn({ fetchImpl: fetch })
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

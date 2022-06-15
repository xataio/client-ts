import babel, { NodePath, PluginItem } from '@babel/core';
import { CallExpression, FunctionDeclaration } from '@babel/types';
import { Flags } from '@oclif/core';
import chokidar from 'chokidar';
import crypto from 'crypto';
import { OutputChunk, rollup } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';
import { virtualFs } from 'rollup-plugin-virtual-fs';
import { BaseCommand } from '../../base.js';
import auto from '@rollup/plugin-auto-install';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default class WorkersCompile extends BaseCommand {
  static description = 'Extract and compile xata workers';

  static flags = {
    watch: Flags.boolean({
      char: 'w',
      description: 'Watch for changes and recompile',
      default: false
    })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(WorkersCompile);

    const watcher = chokidar.watch('./**/*.ts', {
      ignored: [/(^|[/\\])\../, 'dist/*', 'node_modules/*']
    });

    watcher
      .on('add', (path) => this.#compile(path))
      .on('change', (path) => this.#compile(path))
      .on('ready', async () => {
        if (!flags.watch) await watcher.close();
      });
  }

  async #compile(file: string): Promise<void> {
    const external: string[] = [];
    const functions: Record<string, any> = {};

    babel.transformFileSync(file, {
      presets: ['@babel/preset-typescript'],
      plugins: [
        (): PluginItem => {
          return {
            visitor: {
              ImportDeclaration: {
                enter(path) {
                  external.push(path.toString());
                }
              },
              VariableDeclaration: {
                enter(path) {
                  external.push(path.toString());
                }
              },
              Function: {
                enter(path) {
                  if (isXataWorker(path)) {
                    const args = (path.parent as CallExpression).arguments;

                    const code = path.toString();
                    const id = crypto.createHash('sha1').update(code).digest('hex').substring(0, 7);

                    functions[id] = { code, argsSize: args.length };
                  }
                }
              }
            }
          };
        }
      ]
    });

    for (const [id, worker] of Object.entries(functions)) {
      const bundle = await rollup({
        input: `file://./${file}`,
        output: { file: `file://bundle.js`, format: 'es' },
        plugins: [
          virtualFs({
            memoryOnly: false,
            files: {
              [`./${file}`]: `${external.join('\n')}\nexport default ${worker.code};`
            }
          }),
          auto(),
          resolve(),
          commonjs(),
          esbuild()
        ]
      });

      const { output } = await bundle.generate({});

      console.log({
        id,
        code: worker.code,
        bundle: output.map((item) => (item as OutputChunk).code).join('\n')
      });
    }
  }
}

function isXataWorker(path: NodePath): path is NodePath<FunctionDeclaration> {
  if (!path.parentPath?.isCallExpression()) return false;
  const parent = path.parent as CallExpression;
  if (!('callee' in parent)) return false;
  if (!('name' in parent.callee)) return false;
  return parent.callee.name === 'xataWorker';
}

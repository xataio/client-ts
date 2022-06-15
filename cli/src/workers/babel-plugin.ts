/* eslint-disable @typescript-eslint/no-unused-vars */
import { NodePath, PluginObj } from '@babel/core';
import { CallExpression, FunctionDeclaration } from '@babel/types';
import crypto from 'crypto';
import fs from 'fs';
import { dirname, join, resolve } from 'path';

const plugin = (): PluginObj => {
  let imports: Record<string, Record<string, string | undefined>> = {};
  let functions: Record<string, string> = {};

  return {
    name: 'xata-workers',
    visitor: {
      Program: {
        exit(path, state) {
          const options = state.opts as Record<string, unknown>;
          const root = String(options['root']);
          const clientPath = join(root, String(options['clientPath']));
          const output = String(options['output']);

          const importsSource = Object.entries(imports)
            .map(([pkg, specifiers]) => {
              const entries = Object.entries(specifiers);
              const def = entries.find(([, imported]) => !imported);
              const named = entries.filter(([, imported]) => imported);

              const a = def ? def[0] : '';
              const b = named.length > 0 ? `{${named.map(([n, imported]) => `${imported} as ${n}`)}}` : '';

              return `import ${[a, b].filter(Boolean).join(', ')} from '${pkg}'`;
            })
            .join('\n');

          const source = `
${importsSource}

import { XataClient } from '${clientPath}'

const corsHeaders = {
'Access-Control-Allow-Origin': '*',
'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
'Access-Control-Max-Age': '86400',
};

const workers = {
${Object.entries(functions)
  .map(([name, fn]) => `'${name}': ${fn}`)
  .join(',\n  ')}
}

export default {
async fetch(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
    })
  } else {
    const url = new URL(request.url)
    const worker = url.searchParams.get('worker')
    const args = JSON.parse(url.searchParams.get('args'))
    const result = await workers[worker].apply({
      xata: new XataClient({apiKey: XATA_API_KEY }),
    }, args)
    return new Response(JSON.stringify(result), {
      headers: corsHeaders
    });
  }
},
};

`;
          fs.writeFileSync(join(output, 'index.js'), source);

          imports = {};
          functions = {};
        }
      },
      ImportDeclaration: {
        enter(path, state) {
          const options = state.opts as Record<string, unknown>;
          const root = String(options['root']);

          for (const specifier of path.node.specifiers) {
            const binding = path.scope.getBinding(specifier.local.name);
            if (!binding) continue;
            const refPaths = binding.referencePaths;
            for (const refPath of refPaths) {
              const usedInWorker = refPath.find((path) => {
                if (!path.isFunction()) return false;
                return isXataWorker(path);
              });

              if (usedInWorker) {
                const source = path.node.source.value;
                const sourcePath =
                  source.startsWith('./') || source.startsWith('../')
                    ? resolve(dirname(state.filename ?? ''), source)
                    : join(root, 'node_modules', source);
                const hash = crypto.createHash('sha1').update(sourcePath).digest('hex').substring(0, 7);

                const importedName =
                  'imported' in specifier && 'name' in specifier.imported ? specifier.imported.name : undefined;

                // Rename imports to avoid name collisions
                const name = `$${importedName || specifier.local.name}_${hash}`;
                refPath.scope.rename(specifier.local.name, name);

                imports[sourcePath] = imports[sourcePath] || {};
                imports[sourcePath][name] = importedName;
              }
            }
          }
        }
      },
      Function: {
        enter(path, state) {
          if (isXataWorker(path)) {
            const name = path.node.id?.name;
            if (name) {
              functions[name] = path.toString();
            }
          }
        }
      }
    }
  };
};

function isXataWorker(path: NodePath): path is NodePath<FunctionDeclaration> {
  if (!path.parentPath?.isCallExpression()) return false;
  const parent = path.parent as CallExpression;
  if (!('callee' in parent)) return false;
  if (!('name' in parent.callee)) return false;
  return parent.callee.name === 'xataWorker';
}

export default plugin;

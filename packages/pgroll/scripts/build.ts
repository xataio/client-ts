import fs from 'fs/promises';
import { Project, ScriptTarget, VariableDeclarationKind } from 'ts-morph';
import { z } from 'zod';
import { PGROLL_JSON_SCHEMA_URL } from '../src';
import prettier from 'prettier';

type Def =
  | { type: 'string' | 'boolean' | 'number'; description?: string }
  | { $ref: string; description?: string }
  | {
      type: 'object';
      properties: Record<string, Def>;
      required?: string[];
      description?: string;
      additionalProperties?: boolean;
    }
  | { type: 'array'; items: Def | Def[]; description?: string }
  | { anyOf: Def[] };

const DefSchema: z.ZodSchema<Def> = z.lazy(() =>
  z.union([
    z.object({
      type: z.enum(['string', 'boolean', 'number']),
      description: z.string().optional()
    }),
    z.object({
      $ref: z.string(),
      description: z.string().optional()
    }),
    z.object({
      type: z.literal('object'),
      properties: z.record(DefSchema),
      required: z.array(z.string()).optional(),
      description: z.string().optional(),
      additionalProperties: z.boolean().optional()
    }),
    z.object({
      type: z.literal('array'),
      items: z.union([DefSchema, z.array(DefSchema)]),
      description: z.string().optional()
    }),
    z.object({
      anyOf: z.array(DefSchema)
    })
  ])
);

const JSONSchema = z.object({
  $id: z.string(),
  $schema: z.string(),
  title: z.string(),
  description: z.string(),
  $defs: z.record(DefSchema)
});

function buildZodSchema(definition: Def): string {
  if ('$ref' in definition) {
    return definition.$ref.replace(/^#\/\$defs\//, '') + 'Definition';
  }

  if ('anyOf' in definition) {
    const schemas = definition.anyOf.map(buildZodSchema).join(', ');
    return `z.union([${schemas}])`;
  }

  if (definition.type === 'array') {
    const itemsSchema = Array.isArray(definition.items)
      ? buildZodSchema(definition.items[0])
      : buildZodSchema(definition.items);
    return `z.array(${itemsSchema})`;
  }

  if (definition.type === 'object') {
    const properties: string[] = [];
    for (const [name, property] of Object.entries(definition.properties)) {
      const optional = definition.required?.includes(name) ? '' : '.optional()';
      properties.push(`${name}: ${buildZodSchema(property)}${optional}`);
    }

    return `z.object({ ${properties.join(', ')} })`;
  }

  if (definition.type === 'string') {
    return 'z.string()';
  }

  if (definition.type === 'boolean') {
    return 'z.boolean()';
  }

  if (definition.type === 'number') {
    return 'z.number()';
  }

  throw new Error(`Unknown type: ${definition.type}`);
}

function getDependencies(definition: Def): string[] {
  if ('$ref' in definition) {
    return [definition.$ref.replace(/^#\/\$defs\//, '')];
  }

  if ('anyOf' in definition) {
    return definition.anyOf.flatMap(getDependencies);
  }

  if (definition.type === 'array') {
    return Array.isArray(definition.items)
      ? definition.items.flatMap(getDependencies)
      : getDependencies(definition.items);
  }

  if (definition.type === 'object') {
    return Object.values(definition.properties).flatMap(getDependencies);
  }

  return [];
}

function topologicalSort(nodes: [string, Def][]): [string, Def][] {
  const sorted: [string, Def][] = [];
  const visited = new Set<string>();

  function visit(name: string) {
    if (visited.has(name)) return;
    visited.add(name);

    const node = nodes.find(([n]) => n === name);
    if (!node) throw new Error(`Unknown node: ${name}`);

    for (const dep of getDependencies(node[1])) {
      visit(dep);
    }

    sorted.push(node);
  }

  for (const [name] of nodes) {
    visit(name);
  }

  return sorted;
}

async function main() {
  // Fetch the schema from the URL and write it to a file.
  const response = await fetch(PGROLL_JSON_SCHEMA_URL).then((response) => response.json());
  const schema = JSONSchema.parse(response);

  const project = new Project({ compilerOptions: { target: ScriptTarget.ESNext } });
  const file = project.createSourceFile('types.ts', '', { overwrite: true });

  file.addImportDeclaration({ moduleSpecifier: 'zod', namedImports: ['z'] });

  const statements = topologicalSort(Object.entries(schema.$defs)).map(([name, definition]) => [
    name,
    buildZodSchema(definition)
  ]);

  for (const [name, statement] of statements) {
    file.addTypeAlias({ name, type: `z.infer<typeof ${name}Definition>`, isExported: true });
    file.addVariableStatement({
      declarationKind: VariableDeclarationKind.Const,
      declarations: [{ name: `${name}Definition`, initializer: statement }],
      isExported: true
    });
  }

  file.addTypeAlias({
    name: 'OperationType',
    type: `(typeof operationTypes)[number]`,
    isExported: true
  });

  const operationTypes = (schema.$defs['PgRollOperation'] as any).anyOf.flatMap((def) => Object.keys(def.properties));
  file.addVariableStatement({
    declarationKind: VariableDeclarationKind.Const,
    declarations: [
      {
        name: 'operationTypes',
        initializer: `[${operationTypes.map((name) => `'${name}'`).join(', ')}] as const`
      }
    ],
    isExported: true
  });

  await fs.writeFile('src/types.ts', prettier.format(file.getFullText(), { parser: 'typescript' }));
}

main();

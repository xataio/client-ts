import fs from 'fs/promises';
import { Project, ScriptTarget, VariableDeclarationKind } from 'ts-morph';
import { z } from 'zod';
import { PGROLL_JSON_SCHEMA_URL } from '../src';
import prettier from 'prettier';

type DefintionType = 'string' | 'boolean' | 'number' | 'null';

type Definition =
  | { type: DefintionType | DefintionType[]; description?: string }
  | { $ref: string; description?: string }
  | {
      type: 'object';
      properties: Record<string, Definition>;
      oneOf?: unknown[];
      required?: string[];
      description?: string;
      additionalProperties?: boolean;
    }
  | { type: 'array'; items: Definition | Definition[]; description?: string }
  | { anyOf: Definition[] };

const DefinitionTypeSchema = z.enum(['string', 'boolean', 'number', 'null']);

const DefinitionSchema: z.ZodSchema<Definition> = z.lazy(() =>
  z.union([
    z.object({
      type: z.union([DefinitionTypeSchema, z.array(DefinitionTypeSchema)]),
      description: z.string().optional()
    }),
    z.object({
      $ref: z.string(),
      description: z.string().optional()
    }),
    z.object({
      type: z.literal('object'),
      properties: z.record(DefinitionSchema),
      // TODO: Add full support for oneOf
      oneOf: z.array(z.any()).optional(),
      required: z.array(z.string()).optional(),
      description: z.string().optional(),
      additionalProperties: z.boolean().optional()
    }),
    z.object({
      type: z.literal('array'),
      items: z.union([DefinitionSchema, z.array(DefinitionSchema)]),
      description: z.string().optional()
    }),
    z.object({
      anyOf: z.array(DefinitionSchema)
    })
  ])
);

const JSONSchema = z.object({
  $id: z.string(),
  $schema: z.string(),
  title: z.string(),
  description: z.string(),
  $defs: z.record(DefinitionSchema)
});

function buildZodSchema(definition: Definition): string {
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

  const types = typeof definition.type === 'string' ? [definition.type] : definition.type;
  const zodTypes = types.map((type) => {
    if (type === 'string') return 'z.string()';
    if (type === 'boolean') return 'z.boolean()';
    if (type === 'number') return 'z.number()';
    if (type === 'null') return 'z.null()';
    throw new Error(`Unknown type: ${type}`);
  });

  if (zodTypes.length === 1) return zodTypes[0];
  return `z.union([${zodTypes.join(', ')}])`;
}

function getDependencies(definition: Definition): string[] {
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

function topologicalSort(nodes: [string, Definition][]): [string, Definition][] {
  const sorted: [string, Definition][] = [];
  const visited = new Set<string>();

  // Recursive function to visit nodes in a topological order
  function visit(name: string) {
    if (visited.has(name)) return;
    visited.add(name);

    const node = nodes.find(([n]) => n === name);
    if (!node) throw new Error(`Unknown node: ${name}`);

    // Visit dependencies before adding the current node
    for (const dep of getDependencies(node[1])) {
      visit(dep);
    }

    sorted.push(node);
  }

  // Visit all nodes in the graph
  for (const [name] of nodes) {
    visit(name);
  }

  return sorted;
}

async function main() {
  const url = process.env.PGROLL_JSON_SCHEMA_URL ?? PGROLL_JSON_SCHEMA_URL;
  const response = await fetch(url).then((response) => response.json());
  const schema = JSONSchema.parse(response);

  // Create a TypeScript project
  const project = new Project({ compilerOptions: { target: ScriptTarget.ESNext } });
  const schemaFile = project.createSourceFile('schema.ts', '', { overwrite: true });
  const typesFile = project.createSourceFile('types.ts', '', { overwrite: true });

  // Write the JSON schema to a file
  schemaFile.addStatements(`export const schema = ${JSON.stringify(response, null, 2)} as const;`);

  // Add import statements
  typesFile.addImportDeclaration({ moduleSpecifier: 'zod', namedImports: ['z'] });

  // Topologically sort the schema definitions
  const statements = topologicalSort(Object.entries(schema.$defs)).map(([name, definition]) => [
    name,
    buildZodSchema(definition)
  ]);

  // Generate TypeScript code for each definition
  for (const [name, statement] of statements) {
    // Add a type alias for the Zod type
    typesFile.addTypeAlias({ name, type: `z.infer<typeof ${name}Definition>`, isExported: true });
    // Add a variable statement for the Zod schema
    typesFile.addVariableStatement({
      declarationKind: VariableDeclarationKind.Const,
      declarations: [{ name: `${name}Definition`, initializer: statement }],
      isExported: true
    });
  }

  // Add a type alias for the OperationType
  typesFile.addTypeAlias({
    name: 'OperationType',
    type: `(typeof operationTypes)[number]`,
    isExported: true
  });

  // Extract operation types from the schema and add a variable statement
  const operationTypes = (schema.$defs['PgRollOperation'] as any).anyOf.flatMap((def) => Object.keys(def.properties));
  typesFile.addVariableStatement({
    declarationKind: VariableDeclarationKind.Const,
    declarations: [
      {
        name: 'operationTypes',
        initializer: `[${operationTypes.map((name) => `'${name}'`).join(', ')}] as const`
      }
    ],
    isExported: true
  });

  // Write the generated TypeScript code to a file
  await fs.writeFile('src/schema.ts', prettier.format(schemaFile.getFullText(), { parser: 'typescript' }));
  await fs.writeFile('src/types.ts', prettier.format(typesFile.getFullText(), { parser: 'typescript' }));
}

main();

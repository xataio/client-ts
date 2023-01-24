import { Project } from 'ts-morph';
import ts from 'typescript';
import { GenerateOptions } from './codegen';
import { xataDatabaseSchema } from './schema';

export function parseTablesFromCodegen(
  content: string,
  { moduleType, javascriptTarget }: Pick<GenerateOptions, 'moduleType' | 'javascriptTarget'> = {}
) {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      module: moduleType === 'cjs' ? ts.ModuleKind.CommonJS : ts.ModuleKind.ESNext,
      target: ts.ScriptTarget[javascriptTarget ?? 'ES2020']
    }
  });

  const sourceFile = project.createSourceFile('xata.ts', content);

  // TODO: FIXME
  const source =
    sourceFile.getVariableDeclaration('tables')?.getInitializer()?.getText()?.replace('as const', '') ?? '[]';
  console.log(source);
  const tables = JSON.parse(source);
  const result = xataDatabaseSchema.safeParse({ tables });

  return result.success ? result.data.tables : null;
}

import { Namespace, NamespaceBuildOptions } from '../namespace';
import { BaseData } from './record';
import { LinkDictionary, Repository, RestRepository } from './repository';

export * from './operators';
export * from './pagination';
export { Query } from './query';
export { isIdentifiable, isXataRecord } from './record';
export type { Identifiable, XataRecord } from './record';
export { Repository, RestRepository } from './repository';

type SchemaDefinition = {
  table: string;
  links?: LinkDictionary;
};

export type SchemaNamespaceResult<Schemas extends Record<string, BaseData>> = {
  [Key in keyof Schemas]: Repository<Schemas[Key]>;
};

export class SchemaNamespace<Schemas extends Record<string, BaseData>> extends Namespace {
  constructor(private schemas: { [Key in keyof Schemas]: SchemaDefinition }) {
    super();
  }

  build(options: NamespaceBuildOptions): SchemaNamespaceResult<Schemas> {
    const { getFetchProps } = options;

    const schemaNamespace: any = Object.fromEntries(
      Object.entries(this.schemas).map(([name, { table, links }]) => [
        name,
        new RestRepository({ schemaNamespace, getFetchProps, table, links })
      ])
    );

    return schemaNamespace;
  }
}

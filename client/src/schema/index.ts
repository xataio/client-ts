import { Namespace, NamespaceBuildOptions } from '../namespace';
import { isString } from '../util/lang';
import { BaseData } from './record';
import { LinkDictionary, Repository, RestRepository } from './repository';

export * from './operators';
export * from './pagination';
export { Query } from './query';
export { isIdentifiable, isXataRecord } from './record';
export type { Identifiable, XataRecord } from './record';
export { Repository, RestRepository } from './repository';

export type SchemaDefinition = {
  table: string;
  links?: LinkDictionary;
};

export type SchemaNamespaceResult<Schemas extends Record<string, BaseData>> = {
  [Key in keyof Schemas]: Repository<Schemas[Key]>;
};

export class SchemaNamespace<Schemas extends Record<string, BaseData>> extends Namespace {
  constructor(private links?: LinkDictionary) {
    super();
  }

  build(options: NamespaceBuildOptions): SchemaNamespaceResult<Schemas> {
    const { getFetchProps } = options;

    const links = this.links;

    const schemaNamespace: any = new Proxy(
      {},
      {
        get: (_target, table) => {
          if (!isString(table)) throw new Error('Invalid table name');
          return new RestRepository({ schemaNamespace, getFetchProps, table, links });
        }
      }
    );

    return schemaNamespace;
  }
}

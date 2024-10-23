import type { BaseClientOptions, SchemaInference, XataRecord } from '../../client/src';
declare const schema: {
  readonly tables: readonly [
    {
      readonly name: 'teams';
      readonly columns: readonly [
        {
          readonly name: 'xata_id';
          readonly type: 'string';
          readonly notNull: true;
        },
        {
          readonly name: 'xata_version';
          readonly type: 'int';
          readonly notNull: true;
        },
        {
          readonly name: 'xata_createdat';
          readonly type: 'datetime';
          readonly notNull: true;
        },
        {
          readonly name: 'xata_updatedat';
          readonly type: 'datetime';
          readonly notNull: true;
        },
        {
          readonly name: 'name';
          readonly type: 'string';
        },
        {
          readonly name: 'description';
          readonly type: 'text';
        },
        {
          readonly name: 'labels';
          readonly type: 'multiple';
        },
        {
          readonly name: 'index';
          readonly type: 'int';
        },
        {
          readonly name: 'rating';
          readonly type: 'float';
        },
        {
          readonly name: 'founded_date';
          readonly type: 'datetime';
        },
        {
          readonly name: 'email';
          readonly type: 'email';
        },
        {
          readonly name: 'plan';
          readonly type: 'string';
        },
        {
          readonly name: 'dark';
          readonly type: 'bool';
        },
        {
          readonly name: 'config';
          readonly type: 'json';
        },
        {
          readonly name: 'owner';
          readonly type: 'link';
          readonly link: {
            readonly table: 'users';
          };
        }
      ];
      readonly primaryKey: readonly ['xata_id'];
    },
    {
      readonly name: 'users';
      readonly columns: readonly [
        {
          readonly name: 'xata_id';
          readonly type: 'string';
          readonly notNull: true;
        },
        {
          readonly name: 'xata_version';
          readonly type: 'int';
          readonly notNull: true;
        },
        {
          readonly name: 'xata_createdat';
          readonly type: 'datetime';
          readonly notNull: true;
        },
        {
          readonly name: 'xata_updatedat';
          readonly type: 'datetime';
          readonly notNull: true;
        },
        {
          readonly name: 'email';
          readonly type: 'email';
          readonly unique: true;
        },
        {
          readonly name: 'name';
          readonly type: 'string';
        },
        {
          readonly name: 'photo';
          readonly type: 'file';
          readonly file: {
            readonly defaultPublicAccess: true;
          };
        },
        {
          readonly name: 'attachments';
          readonly type: 'file[]';
        },
        {
          readonly name: 'plan';
          readonly type: 'string';
        },
        {
          readonly name: 'dark';
          readonly type: 'bool';
        },
        {
          readonly name: 'full_name';
          readonly type: 'string';
          readonly notNull: true;
          readonly defaultValue: 'John Doe';
        },
        {
          readonly name: 'index';
          readonly type: 'int';
        },
        {
          readonly name: 'rating';
          readonly type: 'float';
        },
        {
          readonly name: 'birthDate';
          readonly type: 'datetime';
        },
        {
          readonly name: 'street';
          readonly type: 'string';
        },
        {
          readonly name: 'zipcode';
          readonly type: 'int';
        },
        {
          readonly name: 'team';
          readonly type: 'link';
          readonly link: {
            readonly table: 'teams';
          };
        },
        {
          readonly name: 'pet';
          readonly type: 'link';
          readonly link: {
            readonly table: 'pets';
          };
        },
        {
          readonly name: 'account_value';
          readonly type: 'int';
        },
        {
          readonly name: 'vector';
          readonly type: 'vector';
          readonly vector: {
            readonly dimension: 4;
          };
        }
      ];
      readonly primaryKey: readonly ['xata_id'];
    },
    {
      readonly name: 'pets';
      readonly columns: readonly [
        {
          readonly name: 'xata_id';
          readonly type: 'string';
          readonly notNull: true;
        },
        {
          readonly name: 'xata_version';
          readonly type: 'int';
          readonly notNull: true;
        },
        {
          readonly name: 'xata_createdat';
          readonly type: 'datetime';
          readonly notNull: true;
        },
        {
          readonly name: 'xata_updatedat';
          readonly type: 'datetime';
          readonly notNull: true;
        },
        {
          readonly name: 'name';
          readonly type: 'string';
        },
        {
          readonly name: 'type';
          readonly type: 'string';
        },
        {
          readonly name: 'num_legs';
          readonly type: 'int';
        }
      ];
      readonly primaryKey: readonly ['xata_id'];
    }
  ];
};
export type SchemaTables = typeof schema.tables;
export type InferredTypes = SchemaInference<SchemaTables>;
export type Teams = InferredTypes['teams'];
export type TeamsRecord = Teams & XataRecord;
export type Users = InferredTypes['users'];
export type UsersRecord = Users & XataRecord;
export type Pets = InferredTypes['pets'];
export type PetsRecord = Pets & XataRecord;
export type DatabaseSchema = {
  teams: TeamsRecord;
  users: UsersRecord;
  pets: PetsRecord;
};
declare const DatabaseClient: any;
export declare class XataClient extends DatabaseClient<typeof schema> {
  constructor(options?: BaseClientOptions);
}
export {};

import type { BaseClientOptions, SchemaInference, XataRecord } from '../../client/src';
declare const tables: readonly [
  {
    readonly name: 'teams';
    readonly columns: readonly [
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
        readonly name: 'settings';
        readonly type: 'object';
        readonly columns: readonly [
          {
            readonly name: 'plan';
            readonly type: 'string';
          },
          {
            readonly name: 'dark';
            readonly type: 'bool';
          },
          {
            readonly name: 'labels';
            readonly type: 'multiple';
          }
        ];
      },
      {
        readonly name: 'owner';
        readonly type: 'link';
        readonly link: {
          readonly table: 'users';
        };
      }
    ];
  },
  {
    readonly name: 'users';
    readonly columns: readonly [
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
        readonly name: 'settings';
        readonly type: 'object';
        readonly columns: readonly [
          {
            readonly name: 'plan';
            readonly type: 'string';
          },
          {
            readonly name: 'dark';
            readonly type: 'bool';
          },
          {
            readonly name: 'labels';
            readonly type: 'multiple';
          }
        ];
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
        readonly name: 'address';
        readonly type: 'object';
        readonly columns: readonly [
          {
            readonly name: 'street';
            readonly type: 'string';
          },
          {
            readonly name: 'zipcode';
            readonly type: 'int';
          }
        ];
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
      }
    ];
  },
  {
    readonly name: 'pets';
    readonly columns: readonly [
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
  }
];
export type SchemaTables = typeof tables;
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
export declare class XataClient extends DatabaseClient<DatabaseSchema> {
  constructor(options?: BaseClientOptions);
}
export declare const getXataClient: () => XataClient;
export {};

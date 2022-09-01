import { BaseClientOptions, SchemaInference, XataRecord } from '../../client/src';
declare const tables: readonly [
  {
    readonly name: 'teams';
    readonly columns: readonly [
      {
        readonly name: 'name';
        readonly type: 'string';
        readonly unique: true;
        readonly description: 'Name of the team';
      },
      {
        readonly name: 'labels';
        readonly type: 'multiple';
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
        readonly name: 'full_name';
        readonly type: 'string';
        readonly notNull: true;
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
      }
    ];
  }
];
export declare type SchemaTables = typeof tables;
export declare type InferredTypes = SchemaInference<SchemaTables>;
export declare type Teams = InferredTypes['teams'];
export declare type TeamsRecord = Teams & XataRecord;
export declare type Users = InferredTypes['users'];
export declare type UsersRecord = Users & XataRecord;
export declare type DatabaseSchema = {
  teams: TeamsRecord;
  users: UsersRecord;
};
declare const DatabaseClient: any;
export declare class XataClient extends DatabaseClient<DatabaseSchema> {
  constructor(options?: BaseClientOptions);
}
export declare const getXataClient: () => XataClient;
export {};

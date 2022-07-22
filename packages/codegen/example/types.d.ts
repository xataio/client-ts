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
      },
      {
        readonly name: 'full_name';
        readonly type: 'string';
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
export declare type DatabaseSchema = SchemaInference<SchemaTables>;
export declare type Team = DatabaseSchema['teams'];
export declare type TeamRecord = Team & XataRecord;
export declare type User = DatabaseSchema['users'];
export declare type UserRecord = User & XataRecord;
declare const DatabaseClient: any;
export declare class XataClient extends DatabaseClient<SchemaTables> {
  constructor(options?: BaseClientOptions);
}
export {};

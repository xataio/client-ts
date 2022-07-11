import { BaseClientOptions, SchemaInference } from '../../client/src';
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
export declare type DatabaseSchema = SchemaInference<typeof tables>;
export declare type TeamRecord = DatabaseSchema['teams'];
export declare type UserRecord = DatabaseSchema['users'];
declare const DatabaseClient: any;
export declare class XataClient extends DatabaseClient<typeof tables> {
  constructor(options?: BaseClientOptions);
}
export {};

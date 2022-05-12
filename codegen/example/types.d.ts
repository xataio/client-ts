import { BaseClient, Repository, XataClientOptions, XataRecord } from '../../client/src';
export interface Team {
    owner?: UserRecord | null;
    name?: string | null;
    labels?: string[] | null;
}
export declare type TeamRecord = Team & XataRecord;
export interface User {
    email?: string | null;
    team?: TeamRecord | null;
    full_name?: string | null;
    address?: {
        zipcode?: number | null;
        street?: string | null;
    } | null;
}
export declare type UserRecord = User & XataRecord;
export declare class XataClient extends BaseClient<{
    "teams": Repository<Team>;
    "users": Repository<User>;
}> {
    constructor(options?: XataClientOptions);
}

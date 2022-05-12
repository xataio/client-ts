import { BaseClient, Repository, XataClientOptions, XataRecord } from '../../client/src';
export interface Team {
    labels?: string[] | null;
    owner?: UserRecord | null;
    name?: string | null;
}
export declare type TeamRecord = Team & XataRecord;
export interface User {
    full_name?: string | null;
    address?: {
        zipcode?: number | null;
        street?: string | null;
    } | null;
    email?: string | null;
    team?: TeamRecord | null;
}
export declare type UserRecord = User & XataRecord;
export declare class XataClient extends BaseClient<{
    "teams": Repository<Team>;
    "users": Repository<User>;
}> {
    constructor(options?: XataClientOptions);
}

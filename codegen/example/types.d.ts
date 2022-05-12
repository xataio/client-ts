import { BaseClient, Repository, XataClientOptions, XataRecord } from '../../client/src';
export interface Team {
    owner?: UserRecord | null;
    name?: string | null;
    labels?: string[] | null;
    a?: string | null;
    b?: string | null;
}
export declare type TeamRecord = Team & XataRecord;
export interface User {
    team?: TeamRecord | null;
    email?: string | null;
    full_name?: string | null;
    address?: {
        zipcode?: number | null;
        street?: string | null;
    } | null;
}
export declare type UserRecord = User & XataRecord;
export interface Foobar {
    name?: string | null;
    email?: string | null;
    count?: number | null;
}
export declare type FoobarRecord = Foobar & XataRecord;
export interface Nasdaq {
    salutation?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    title?: string | null;
    accountName?: string | null;
    mailingStreet?: string | null;
    mailingCity?: string | null;
    mailingState?: string | null;
    mailingZip?: string | null;
    mailingCountry?: string | null;
    phone?: string | null;
    fax?: string | null;
    mobile?: string | null;
    accountOwner?: string | null;
    email?: string | null;
}
export declare type NasdaqRecord = Nasdaq & XataRecord;
export declare class XataClient extends BaseClient<{
    "teams": Repository<Team>;
    "users": Repository<User>;
    "foobar": Repository<Foobar>;
    "nasdaq": Repository<Nasdaq>;
}> {
    constructor(options?: XataClientOptions);
}

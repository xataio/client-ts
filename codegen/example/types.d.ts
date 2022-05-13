import { BaseClientOptions, XataRecord } from '../../client/src';
export interface Team {
    name?: string | null;
    labels?: string[] | null;
    owner?: UserRecord | null;
}
export declare type TeamRecord = Team & XataRecord;
export interface User {
    email?: string | null;
    full_name?: string | null;
    address?: {
        street?: string | null;
        zipcode?: number | null;
    } | null;
    team?: TeamRecord | null;
}
export declare type UserRecord = User & XataRecord;
declare const XataClient_base: any;
export declare class XataClient extends XataClient_base {
    constructor(options?: BaseClientOptions);
}
export {};

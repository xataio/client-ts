export type StringKeys<O> = Extract<keyof O, string>;
export type NumberKeys<O> = Extract<keyof O, number>;
export type Values<O> = O[StringKeys<O>];

export type UnionToIntersection<T> = (T extends any ? (x: T) => any : never) extends (x: infer R) => any ? R : never;

export type If<Condition, Then, Else> = Condition extends true ? Then : Else;

export type IsObject<T> = T extends Record<string, any> ? true : false;
export type IsArray<T> = T extends Array<any> ? true : false;

export type NonEmptyArray<T> = T[] & { 0: T };

export type RequiredBy<T, K extends keyof T> = T & {
  [P in K]-?: NonNullable<T[P]>;
};

export type GetArrayInnerType<T extends readonly any[]> = T[number];

export type AllRequired<T> = {
  [P in keyof T]-?: T[P];
};

export type KeysOfUnion<T> = T extends T ? keyof T : never;

type Impossible<K extends keyof any> = {
  [P in K]: never;
};

export type Exactly<T, U extends T = T> = U & Impossible<Exclude<keyof U, keyof T>>;

export type SingleOrArray<T> = T | T[];

export type Dictionary<T> = Record<string, T>;

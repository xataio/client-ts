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

export type FunctionKeys<T> = {
  [K in keyof T]: T[K] extends (...args: any) => any ? K : never;
}[keyof T];

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

export type OmitBy<T, K extends keyof T> = T extends any ? Omit<T, K> : never;

type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };
export type ExclusiveOr<T, U> = T | U extends object ? (Without<T, U> & U) | (Without<U, T> & T) : T | U;

export type ExclusiveUnion<T> = T extends any ? ExclusiveOr<T, T> : never;

type Explode<T> = keyof T extends infer K
  ? K extends unknown
    ? { [I in keyof T]: I extends K ? T[I] : never }
    : never
  : never;
export type AtMostOne<T> = Explode<Partial<T>>;
export type AtLeastOne<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U];
export type ExactlyOne<T> = AtMostOne<T> & AtLeastOne<T>;

type Fn = (...args: any[]) => any;

type NarrowRaw<A> =
  | (A extends [] ? [] : never)
  | (A extends Narrowable ? A : never)
  | {
      [K in keyof A]: A[K] extends Fn ? A[K] : NarrowRaw<A[K]>;
    };
type Narrowable = string | number | bigint | boolean;
type Try<A1, A2, Catch = never> = A1 extends A2 ? A1 : Catch;

export type Narrow<A> = Try<A, [], NarrowRaw<A>>;

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

export type OmitBy<T, K extends keyof T> = T extends any ? Omit<T, K> : never;

type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };
export type ExclusiveOr<T, U> = T | U extends object ? (Without<T, U> & U) | (Without<U, T> & T) : T | U;

type Explode<T> = keyof T extends infer K
  ? K extends unknown
    ? { [I in keyof T]: I extends K ? T[I] : never }
    : never
  : never;
export type AtMostOne<T> = Explode<Partial<T>>;
export type AtLeastOne<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U];
export type ExactlyOne<T> = AtMostOne<T> & AtLeastOne<T>;

/**
 * Recursively unwraps the "awaited type" of a type. Non-promise "thenables" should resolve to `never`. This emulates the behavior of `await`.
 */
export type Awaited<T> = T extends null | undefined
  ? T // special case for `null | undefined` when not in `--strictNullChecks` mode
  : T extends object & { then(onfulfilled: infer F): any } // `await` only unwraps object types with a callable `then`. Non-object types are not unwrapped
  ? F extends (value: infer V, ...args: any) => any // if the argument to `then` is callable, extracts the first argument
    ? Awaited<V> // recursively unwrap the value
    : never // the argument to `then` was not callable
  : T; // non-object or non-thenable

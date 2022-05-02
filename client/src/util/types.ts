export type StringKeys<O> = Extract<keyof O, string>;
export type NumberKeys<O> = Extract<keyof O, number>;
export type Values<O> = O[StringKeys<O>];

export type UnionToIntersection<T> = (T extends any ? (x: T) => any : never) extends (x: infer R) => any ? R : never;

type IfEquals<T, U, Y = unknown, N = never> = (<G>() => G extends T ? 1 : 2) extends <G>() => G extends U ? 1 : 2
  ? Y
  : N;

export declare const exactType: <T, U>(draft: T & IfEquals<T, U>, expected: U & IfEquals<T, U>) => IfEquals<T, U>;

export type If<Condition, Then, Else> = Condition extends true ? Then : Else;

export type IsObject<T> = T extends Record<string, any> ? true : false;
export type IsArray<T> = T extends Array<any> ? true : false;

export type NonEmptyArray<T> = T[] & { 0: T };

export type RequiredBy<T, K extends keyof T> = T & {
  [P in K]-?: NonNullable<T[P]>;
};

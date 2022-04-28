export type StringKeys<O> = Extract<keyof O, string>;
export type NumberKeys<O> = Extract<keyof O, number>;
export type Values<O> = O[keyof O];

export type UnionToIntersection<T> = (T extends any ? (x: T) => any : never) extends (x: infer R) => any ? R : never;

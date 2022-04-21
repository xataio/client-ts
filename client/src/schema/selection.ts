import { XataRecord } from '..';
import { StringKeys, UnionToIntersection, Values } from '../util/types';
import { Query } from './query';
import { Identifiable } from './record';

type Queries<T> = {
  [key in keyof T as T[key] extends Query<any> ? key : never]: T[key];
};

type OmitQueries<T> = {
  [key in keyof T as T[key] extends Query<any> ? never : key]: T[key];
};

type OmitLinks<T> = {
  [key in keyof T as T[key] extends XataRecord ? never : key]: T[key];
};

type OmitMethods<T> = {
  // eslint-disable-next-line @typescript-eslint/ban-types
  [key in keyof T as T[key] extends Function ? never : key]: T[key];
};

type InternalProperties = keyof XataRecord;
export type Selectable<T extends XataRecord> = Omit<T, InternalProperties> & Partial<Identifiable>;

export type SelectableColumn<O> = O extends Array<unknown>
  ? never // For now we only support string arrays
  :
      | '*'
      | 'id'
      | (O extends Record<string, any>
          ?
              | '*'
              | Values<{
                  [K in StringKeys<O>]: O[K] extends Record<string, any>
                    ? SelectableColumn<O[K]> extends ''
                      ? `${K}`
                      : `${K}.${SelectableColumn<O[K]>}`
                    : K;
                }>
          : '');

export type ValueOfSelectableColumn<O, P extends SelectableColumn<O>> = P extends '*'
  ? Values<O>
  : P extends 'id'
  ? string
  : P extends keyof O
  ? O[P]
  : P extends `${infer K}.${infer V}`
  ? K extends keyof O
    ? V extends SelectableColumn<O[K]>
      ? ValueOfSelectableColumn<O[K], V>
      : never
    : never
  : never;

export type Select<T, K extends SelectableColumn<T>> = UnionToIntersection<K extends keyof T ? Pick<T, K> : T> &
  Queries<T> &
  XataRecord;

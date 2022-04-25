import { StringKeys, UnionToIntersection, Values } from '../util/types';
import { Query } from './query';
import { BaseData, Identifiable, XataRecord } from './record';

type Queries<T> = {
  [key in keyof T as T[key] extends Query<any, any> ? key : never]: T[key];
};

export type Selectable<T extends BaseData> = T & Partial<Identifiable>;

export type SelectableColumn<O> =
  | '*'
  | (O extends Array<unknown>
      ? never // TODO: Review when we support multiple: true
      : O extends Record<string, any>
      ?
          | '*'
          | Values<{
              [K in StringKeys<O>]: O[K] extends Record<string, any> ? `${K}.${SelectableColumn<O[K]>}` : K;
            }>
      : '');

export type Select<T, K extends SelectableColumn<T>> = UnionToIntersection<K extends keyof T ? Pick<T, K> : T> &
  Queries<T> &
  XataRecord;

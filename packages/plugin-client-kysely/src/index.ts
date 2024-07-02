export type Model<Schemas extends Record<string, any>> = {
  [Model in keyof Schemas]: Schemas[Model];
};

export * from './driver';

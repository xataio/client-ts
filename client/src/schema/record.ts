import { Selectable } from './selection';

export interface XataRecord {
  id: string;
  xata: {
    version: number;
  };

  read(): Promise<this>;
  update(data: Partial<Selectable<this>>): Promise<this>;
  delete(): Promise<void>;
}

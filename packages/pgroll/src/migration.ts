import { z } from 'zod';
import {
  createTableOperation,
  addColumnOperation,
  renameTableOperation,
  sqlOperation,
  dropTableOperation,
  dropColumnOperation,
  createIndexOperation,
  dropIndexOperation,
  alterColumnOperation,
  setReplicaIdentityOperation,
  dropConstraintOperation
} from './operations';

export type Migration = z.infer<typeof migration>;

export const migration = z.object({
  name: z.string(),
  operations: z.array(
    z.union([
      createTableOperation,
      addColumnOperation,
      renameTableOperation,
      sqlOperation,
      dropTableOperation,
      dropColumnOperation,
      createIndexOperation,
      dropIndexOperation,
      alterColumnOperation,
      setReplicaIdentityOperation,
      dropConstraintOperation
    ])
  )
});

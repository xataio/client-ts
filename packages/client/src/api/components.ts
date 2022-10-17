export * from './dataPlaneComponents';
export * from './controlPlaneComponents';

import { operationsByTag as dataPlaneOperations } from './dataPlaneComponents';
import { operationsByTag as controlPlaneOperations } from './controlPlaneComponents';

import { deepMerge } from '../util/lang';

export const operationsByTag = deepMerge(dataPlaneOperations, controlPlaneOperations);

import { ToBoolean } from '../src/types';

export const yepNopeToBoolean: ToBoolean = (value) => {
  if (value === 'yep') {
    return true;
  }
  if (value === 'nope') {
    return false;
  }
  return null;
};

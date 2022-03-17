import type { Language } from './codegen';
import { errors } from './errors';

export const getLanguageFromExtension = (extension?: 'ts' | 'js'): Language => {
  switch (extension) {
    case 'js':
      return 'javascript';
    case 'ts':
    case undefined:
      return 'typescript';
    default:
      throw new Error(errors.invalidCodegenOutputExtension);
  }
};

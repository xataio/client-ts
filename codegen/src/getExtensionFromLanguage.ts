import type { Language } from './codegen';

export const getExtensionFromLanguage = (language?: Language) => {
  switch (language) {
    case 'javascript':
    case 'js':
      return '.js';
    case 'typescript':
    case 'ts':
    case undefined:
      return '.ts';
    default:
      throw new Error('Invalid language specified.');
  }
};

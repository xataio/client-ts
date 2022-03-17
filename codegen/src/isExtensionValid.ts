export const isExtensionValid = (extension: string): extension is 'js' | 'ts' => ['ts', 'js'].includes(extension);

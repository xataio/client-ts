import { Flags } from '@oclif/core';

type EnumFlagOptions<Enum> = {
  description?: string;
  options: (Enum | string)[];
};

export const enumFlag = <Enum extends string>(options: EnumFlagOptions<Enum>) => {
  return Flags.custom<Enum>({ ...options, multiple: false })();
};

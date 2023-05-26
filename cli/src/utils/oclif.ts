import { Flags } from '@oclif/core';
import { FlagProps } from '@oclif/core/lib/interfaces/parser';

type EnumFlagOptions<Enum> = Omit<FlagProps, 'name'> & {
  options: (Enum | string)[];
};

export const enumFlag = <Enum extends string>(options: EnumFlagOptions<Enum>) => {
  return Flags.custom<Enum>(options)();
};

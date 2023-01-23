export type BranchStrategyValue = string | undefined | null;
export type BranchStrategyBuilder = () => BranchStrategyValue;
export type BranchStrategy = BranchStrategyValue | BranchStrategyBuilder;
export type BranchStrategyOption = NonNullable<BranchStrategy | BranchStrategy[]>;

export const isBranchStrategyBuilder = (strategy: BranchStrategy): strategy is BranchStrategyBuilder => {
  return typeof strategy === 'function';
};

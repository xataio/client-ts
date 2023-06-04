// https://stackoverflow.com/a/6671856
const VALID_JAVASCRIPT_VARIABLE = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/;

export const isValidJavascriptVariable = (variable: string) => VALID_JAVASCRIPT_VARIABLE.test(variable);

// We support table names which aren't valid javascript variables e.g. 'table-2' `xata.db.table-2` is not valid.
export const getDbTableExpression = (table: string) =>
  isValidJavascriptVariable(table) ? `.${table}` : `['${table}']`;

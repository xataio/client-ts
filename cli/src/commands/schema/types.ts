export type ColumnData = {
  name: string;
  type: string;
  unique: boolean;
  nullable: boolean;
  defaultValue?: string;
  vector?: {
    dimension: number;
  };
  originalName: string;
  tableName: string;
  link?: {
    table: string;
  };
  file?: {
    defaultPublicAccess: boolean;
  };
  'file[]'?: {
    defaultPublicAccess: boolean;
  };
};

export type AddTablePayload = {
  type: 'add-table';
  table: {
    name: string;
  };
};

export type EditTablePayload = {
  type: 'edit-table';
  table: {
    name: string;
    newName: string;
  };
};

export type AddColumnPayload = {
  type: 'add-column';
  tableName: string;
  column: ColumnData;
};

export type ColumnAdditionData = { [tableName: string]: { [columnName: string]: AddColumnPayload['column'] } };

export type EditColumnPayload = {
  type: 'edit-column';
  column: ColumnData;
};

export type FormatPayload = {
  type: 'space' | 'migrate' | 'schema';
};

export type SelectChoice = {
  name: FormatPayload | AddTablePayload | EditTablePayload | AddColumnPayload | EditColumnPayload;
  message: string;
  role?: string;
  choices?: SelectChoice[];
  disabled?: boolean;
  hint?: string;
};

export type DeleteTablePayload = {
  name: string;
};

export type DeleteColumnPayload = { [tableName: string]: string[] };

export type ValidationState = { values: { name: string }; items: { name: string; input: string }[] };

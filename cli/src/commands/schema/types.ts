type ColumnData = {
  name: string;
  type: string;
  unique: boolean;
  nullable: boolean;
  defaultValue?: string;
  vectorDimension?: string;
  originalName: string;
  tableName: string;
  link?: {
    table: string;
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

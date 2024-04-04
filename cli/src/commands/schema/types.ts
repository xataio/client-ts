
export type AddTablePayload = {
    type: 'add-table';
    table: {
      name: string;
      columns:  {
        name: string;
        type: string;
        unique: boolean;
        nullable: boolean;
        default?: string;
        vectorDimension?: string
        link?: string
      }[];
    }
  }
  
  export type EditTablePayload =  {
    type: 'edit-table';
    table: {
      name: string;
      newName: string
    };
  }
  
  export type AddColumnPayload = {
    type: 'add-column';
    tableName: string;
    column: {
      name: string;
      type: string;
      unique: boolean;
      nullable: boolean;
      defaultValue?: string;
      vectorDimension?: string
      link?: string
    }
  }

  export type DeleteColumnPayload = { [tableName: string]: string[] }
  
  export type EditColumnPayload = {
    type: 'edit-column';
    column: {
      name: string;
      unique: boolean;
      nullable: boolean;
      originalName: string;
      tableName: string
      defaultValue: any
      type: string
    };
  }

  export type DeleteTablePayload = {
    name: string;
  }
  
  export type FormatPayload = {
    type: 'space' | 'migrate' | 'schema';
  }
  
  export type SelectChoice = {
    name:
      | FormatPayload
      | AddTablePayload
      | EditTablePayload
      | AddColumnPayload
    | EditColumnPayload
    message: string;
    role?: string;
    choices?: SelectChoice[];
    disabled?: boolean;
    hint?: string;
  }
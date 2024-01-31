export const schema = {
  $id: 'https://raw.githubusercontent.com/xataio/pgroll/main/schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'JSON Schema for pgroll migrations',
  description: 'This JSON schema defines the structure and properties of pgroll migrations.',
  allOf: [
    {
      $ref: '#/$defs/PgRollMigration'
    }
  ],
  $defs: {
    CheckConstraint: {
      additionalProperties: false,
      description: 'Check constraint definition',
      properties: {
        constraint: {
          description: 'Constraint expression',
          type: 'string'
        },
        name: {
          description: 'Name of check constraint',
          type: 'string'
        }
      },
      required: ['constraint', 'name'],
      type: 'object'
    },
    Column: {
      additionalProperties: false,
      description: 'Column definition',
      properties: {
        check: {
          $ref: '#/$defs/CheckConstraint',
          description: 'Check constraint for the column'
        },
        default: {
          description: 'Default value for the column',
          type: 'string'
        },
        name: {
          description: 'Name of the column',
          type: 'string'
        },
        nullable: {
          description: 'Indicates if the column is nullable',
          type: 'boolean'
        },
        pk: {
          description: 'Indicates if the column is part of the primary key',
          type: 'boolean'
        },
        references: {
          $ref: '#/$defs/ForeignKeyReference',
          description: 'Foreign key constraint for the column'
        },
        type: {
          description: 'Postgres type of the column',
          type: 'string'
        },
        unique: {
          description: 'Indicates if the column values must be unique',
          type: 'boolean'
        }
      },
      required: ['name', 'nullable', 'pk', 'type', 'unique'],
      type: 'object'
    },
    ForeignKeyReference: {
      additionalProperties: false,
      description: 'Foreign key reference definition',
      properties: {
        column: {
          description: 'Name of the referenced column',
          type: 'string'
        },
        name: {
          description: 'Name of the foreign key constraint',
          type: 'string'
        },
        table: {
          description: 'Name of the referenced table',
          type: 'string'
        }
      },
      required: ['column', 'name', 'table'],
      type: 'object'
    },
    OpAddColumn: {
      additionalProperties: false,
      description: 'Add column operation',
      properties: {
        column: {
          $ref: '#/$defs/Column',
          description: 'Column to add'
        },
        table: {
          description: 'Name of the table',
          type: 'string'
        },
        up: {
          description: 'SQL expression for up migration',
          type: 'string'
        }
      },
      required: ['column', 'table'],
      type: 'object'
    },
    OpAlterColumn: {
      additionalProperties: false,
      description: 'Alter column operation',
      properties: {
        check: {
          $ref: '#/$defs/CheckConstraint',
          description: 'Add check constraint to the column'
        },
        column: {
          description: 'Name of the column',
          type: 'string'
        },
        down: {
          description: 'SQL expression for down migration',
          type: 'string'
        },
        name: {
          description: 'New name of the column (for rename column operation)',
          type: 'string'
        },
        nullable: {
          description: 'Indicates if the column is nullable (for add not null constraint operation)',
          type: 'boolean'
        },
        references: {
          $ref: '#/$defs/ForeignKeyReference',
          description: 'Add foreign key constraint to the column'
        },
        table: {
          description: 'Name of the table',
          type: 'string'
        },
        type: {
          description: 'New type of the column (for change type operation)',
          type: 'string'
        },
        unique: {
          $ref: '#/$defs/UniqueConstraint',
          description: 'Add unique constraint to the column'
        },
        up: {
          description: 'SQL expression for up migration',
          type: 'string'
        }
      },
      required: ['column', 'down', 'name', 'table', 'type', 'up'],
      type: 'object'
    },
    OpCreateIndex: {
      additionalProperties: false,
      description: 'Create index operation',
      properties: {
        columns: {
          description: 'Names of columns on which to define the index',
          items: {
            type: 'string'
          },
          type: 'array'
        },
        name: {
          description: 'Index name',
          type: 'string'
        },
        table: {
          description: 'Name of table on which to define the index',
          type: 'string'
        }
      },
      required: ['columns', 'name', 'table'],
      type: 'object'
    },
    OpCreateTable: {
      additionalProperties: false,
      description: 'Create table operation',
      properties: {
        columns: {
          items: {
            $ref: '#/$defs/Column',
            description: 'Columns to add to the table'
          },
          type: 'array'
        },
        name: {
          description: 'Name of the table',
          type: 'string'
        }
      },
      required: ['columns', 'name'],
      type: 'object'
    },
    OpDropColumn: {
      additionalProperties: false,
      description: 'Drop column operation',
      properties: {
        column: {
          description: 'Name of the column',
          type: 'string'
        },
        down: {
          description: 'SQL expression for down migration',
          type: 'string'
        },
        table: {
          description: 'Name of the table',
          type: 'string'
        }
      },
      required: ['column', 'table'],
      type: 'object'
    },
    OpDropConstraint: {
      additionalProperties: false,
      description: 'Drop constraint operation',
      properties: {
        column: {
          description: 'Name of the column',
          type: 'string'
        },
        down: {
          description: 'SQL expression for down migration',
          type: 'string'
        },
        name: {
          description: 'Name of the constraint',
          type: 'string'
        },
        table: {
          description: 'Name of the table',
          type: 'string'
        },
        up: {
          description: 'SQL expression for up migration',
          type: 'string'
        }
      },
      required: ['column', 'down', 'name', 'table', 'up'],
      type: 'object'
    },
    OpDropIndex: {
      additionalProperties: false,
      description: 'Drop index operation',
      properties: {
        name: {
          description: 'Index name',
          type: 'string'
        }
      },
      required: ['name'],
      type: 'object'
    },
    OpDropTable: {
      additionalProperties: false,
      description: 'Drop table operation',
      properties: {
        name: {
          description: 'Name of the table',
          type: 'string'
        }
      },
      required: ['name'],
      type: 'object'
    },
    OpRawSQL: {
      additionalProperties: false,
      description: 'Raw SQL operation',
      properties: {
        down: {
          default: '',
          description: 'SQL expression for down migration',
          type: 'string'
        },
        up: {
          description: 'SQL expression for up migration',
          type: 'string'
        }
      },
      required: ['up'],
      type: 'object'
    },
    OpRenameTable: {
      additionalProperties: false,
      description: 'Rename table operation',
      properties: {
        from: {
          description: 'Old name of the table',
          type: 'string'
        },
        to: {
          description: 'New name of the table',
          type: 'string'
        }
      },
      required: ['from', 'to'],
      type: 'object'
    },
    OpSetReplicaIdentity: {
      additionalProperties: false,
      description: 'Set replica identity operation',
      properties: {
        identity: {
          $ref: '#/$defs/ReplicaIdentity',
          description: 'Replica identity to set'
        },
        table: {
          description: 'Name of the table',
          type: 'string'
        }
      },
      required: ['identity', 'table'],
      type: 'object'
    },
    PgRollOperation: {
      anyOf: [
        {
          type: 'object',
          description: 'Add column operation',
          additionalProperties: false,
          properties: {
            add_column: {
              $ref: '#/$defs/OpAddColumn'
            }
          },
          required: ['add_column']
        },
        {
          type: 'object',
          description: 'Alter column operation',
          additionalProperties: false,
          properties: {
            alter_column: {
              $ref: '#/$defs/OpAlterColumn'
            }
          },
          required: ['alter_column']
        },
        {
          type: 'object',
          description: 'Create index operation',
          additionalProperties: false,
          properties: {
            create_index: {
              $ref: '#/$defs/OpCreateIndex'
            }
          },
          required: ['create_index']
        },
        {
          type: 'object',
          description: 'Create table operation',
          additionalProperties: false,
          properties: {
            create_table: {
              $ref: '#/$defs/OpCreateTable'
            }
          },
          required: ['create_table']
        },
        {
          type: 'object',
          description: 'Drop column operation',
          additionalProperties: false,
          properties: {
            drop_column: {
              $ref: '#/$defs/OpDropColumn'
            }
          },
          required: ['drop_column']
        },
        {
          type: 'object',
          description: 'Drop constraint operation',
          additionalProperties: false,
          properties: {
            drop_constraint: {
              $ref: '#/$defs/OpDropConstraint'
            }
          },
          required: ['drop_constraint']
        },
        {
          type: 'object',
          description: 'Drop index operation',
          additionalProperties: false,
          properties: {
            drop_index: {
              $ref: '#/$defs/OpDropIndex'
            }
          },
          required: ['drop_index']
        },
        {
          type: 'object',
          description: 'Drop table operation',
          additionalProperties: false,
          properties: {
            drop_table: {
              $ref: '#/$defs/OpDropTable'
            }
          },
          required: ['drop_table']
        },
        {
          type: 'object',
          description: 'Raw SQL operation',
          additionalProperties: false,
          properties: {
            raw_sql: {
              $ref: '#/$defs/OpRawSQL'
            }
          },
          required: ['raw_sql']
        },
        {
          type: 'object',
          description: 'Rename table operation',
          additionalProperties: false,
          properties: {
            rename_table: {
              $ref: '#/$defs/OpRenameTable'
            }
          },
          required: ['rename_table']
        },
        {
          type: 'object',
          description: 'Set replica identity operation',
          additionalProperties: false,
          properties: {
            set_replica_identity: {
              $ref: '#/$defs/OpSetReplicaIdentity'
            }
          },
          required: ['set_replica_identity']
        }
      ]
    },
    PgRollOperations: {
      items: {
        $ref: '#/$defs/PgRollOperation'
      },
      type: 'array'
    },
    PgRollMigration: {
      additionalProperties: false,
      description: 'PgRoll migration definition',
      properties: {
        name: {
          description: 'Name of the migration',
          type: 'string'
        },
        operations: {
          $ref: '#/$defs/PgRollOperations'
        }
      },
      required: ['name', 'operations'],
      type: 'object'
    },
    ReplicaIdentity: {
      additionalProperties: false,
      description: 'Replica identity definition',
      properties: {
        index: {
          description: 'Name of the index to use as replica identity',
          type: 'string'
        },
        type: {
          description: 'Type of replica identity',
          type: 'string'
        }
      },
      required: ['index', 'type'],
      type: 'object'
    },
    UniqueConstraint: {
      additionalProperties: false,
      description: 'Unique constraint definition',
      properties: {
        name: {
          description: 'Name of unique constraint',
          type: 'string'
        }
      },
      required: ['name'],
      type: 'object'
    }
  }
} as const;

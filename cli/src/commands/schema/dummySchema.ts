
export const dummySchema = {
    "branchName": "main",
    "createdAt": "2024-04-02T06:40:39.989Z",
    "databaseName": "csv",
    "id": "bb_fipug7tus17st2pgt6l07q3bn8_o2i56v",
    "lastMigrationID": "",
    "version": 1,
    "metadata": {},
    "schema": {
        "tables": [
            {
                "name": "44",
                "xataCompatible": true,
                "checkConstraints": {
                    "44_xata_id_length_xata_id": {
                        "name": "44_xata_id_length_xata_id",
                        "columns": [
                            "xata_id"
                        ],
                        "definition": "CHECK ((length(xata_id) < 256))"
                    },
                    "44_xata_string_length_stringggrenamed": {
                        "name": "44_xata_string_length_stringggrenamed",
                        "columns": [
                            "emm"
                        ],
                        "definition": "CHECK ((length(emm) <= 2048))"
                    },
                    "44_xata_string_length_test": {
                        "name": "44_xata_string_length_test",
                        "columns": [
                            "test"
                        ],
                        "definition": "CHECK ((length(test) <= 2048))"
                    }
                },
                "foreignKeys": {
                    "fk_image": {
                        "name": "fk_image",
                        "columns": [
                            "symbol"
                        ],
                        "referencedTable": "emily",
                        "referencedColumns": [
                            "xata_id"
                        ],
                        "onDelete": "NO ACTION"
                    },
                    "fk_tag": {
                        "name": "fk_tag",
                        "columns": [
                            "test"
                        ],
                        "referencedTable": "emily",
                        "referencedColumns": [
                            "xata_id"
                        ],
                        "onDelete": "NO ACTION"
                    }
                },
                "primaryKey": [],
                "uniqueConstraints": {
                    "44_stringggrenamed_unique": {
                        "name": "44_stringggrenamed_unique",
                        "columns": [
                            "emm"
                        ]
                    },
                    "_pgroll_new_44_xata_id_key": {
                        "name": "_pgroll_new_44_xata_id_key",
                        "columns": [
                            "xata_id"
                        ]
                    }
                },
                "comment": "",
                "oid": "4563954",
                "columns": [
                    {
                        "name": "emm",
                        "type": "text",
                        "pgType": "text",
                        "notNull": false,
                        "unique": true,
                        "defaultValue": null
                    },
                    {
                        "name": "percentageeee",
                        "type": "float",
                        "pgType": "double precision",
                        "notNull": false,
                        "unique": false,
                        "defaultValue": null
                    },
                    {
                        "name": "price",
                        "type": "float",
                        "pgType": "double precision",
                        "notNull": false,
                        "unique": false,
                        "defaultValue": null
                    },
                    {
                        "name": "symbol",
                        "type": "link",
                        "link": {
                            "table": "emily"
                        },
                        "pgType": "text",
                        "notNull": false,
                        "unique": false,
                        "defaultValue": null
                    },
                    {
                        "name": "test",
                        "type": "link",
                        "link": {
                            "table": "emily"
                        },
                        "pgType": "text",
                        "notNull": false,
                        "unique": false,
                        "defaultValue": null
                    },
                    {
                        "name": "timestamp",
                        "type": "datetime",
                        "pgType": "timestamptz",
                        "notNull": false,
                        "unique": false,
                        "defaultValue": null
                    },
                    {
                        "name": "xata_createdat",
                        "type": "datetime",
                        "pgType": "timestamptz",
                        "notNull": true,
                        "unique": false,
                        "defaultValue": "now()"
                    },
                    {
                        "name": "xata_id",
                        "type": "text",
                        "pgType": "text",
                        "notNull": true,
                        "unique": true,
                        "defaultValue": "('rec_'::text || (xata_private.xid())::text)"
                    },
                    {
                        "name": "xata_updatedat",
                        "type": "datetime",
                        "pgType": "timestamptz",
                        "notNull": true,
                        "unique": false,
                        "defaultValue": "now()"
                    },
                    {
                        "name": "xata_version",
                        "type": "int",
                        "pgType": "integer",
                        "notNull": true,
                        "unique": false,
                        "defaultValue": "0"
                    }
                ]
            },
            {
                "name": "678",
                "xataCompatible": true,
                "checkConstraints": {
                    "678_xata_id_length_xata_id": {
                        "name": "678_xata_id_length_xata_id",
                        "columns": [
                            "xata_id"
                        ],
                        "definition": "CHECK ((length(xata_id) < 256))"
                    }
                },
                "foreignKeys": {},
                "primaryKey": [],
                "uniqueConstraints": {
                    "678_percentageee_unique": {
                        "name": "678_percentageee_unique",
                        "columns": [
                            "percentageee"
                        ]
                    },
                    "_pgroll_new_678_xata_id_key": {
                        "name": "_pgroll_new_678_xata_id_key",
                        "columns": [
                            "xata_id"
                        ]
                    }
                },
                "comment": "",
                "oid": "4564039",
                "columns": [
                    {
                        "name": "percentageee",
                        "type": "float",
                        "pgType": "double precision",
                        "notNull": true,
                        "unique": true,
                        "defaultValue": null
                    },
                    {
                        "name": "pricer",
                        "type": "float",
                        "pgType": "double precision",
                        "notNull": false,
                        "unique": false,
                        "defaultValue": null
                    },
                    {
                        "name": "symbolll",
                        "type": "string",
                        "pgType": "text",
                        "notNull": false,
                        "unique": false,
                        "defaultValue": null
                    },
                    {
                        "name": "timestamp",
                        "type": "datetime",
                        "pgType": "timestamptz",
                        "notNull": false,
                        "unique": false,
                        "defaultValue": null
                    },
                    {
                        "name": "xata_createdat",
                        "type": "datetime",
                        "pgType": "timestamptz",
                        "notNull": true,
                        "unique": false,
                        "defaultValue": "now()"
                    },
                    {
                        "name": "xata_id",
                        "type": "text",
                        "pgType": "text",
                        "notNull": true,
                        "unique": true,
                        "defaultValue": "('rec_'::text || (xata_private.xid())::text)"
                    },
                    {
                        "name": "xata_updatedat",
                        "type": "datetime",
                        "pgType": "timestamptz",
                        "notNull": true,
                        "unique": false,
                        "defaultValue": "now()"
                    },
                    {
                        "name": "xata_version",
                        "type": "int",
                        "pgType": "integer",
                        "notNull": true,
                        "unique": false,
                        "defaultValue": "0"
                    }
                ]
            },
            {
              "name": "emily",
              "xataCompatible": true,
              "checkConstraints": {
                  "678_xata_id_length_xata_id": {
                      "name": "678_xata_id_length_xata_id",
                      "columns": [
                          "xata_id"
                      ],
                      "definition": "CHECK ((length(xata_id) < 256))"
                  }
              },
              "foreignKeys": {},
              "primaryKey": [],
              "uniqueConstraints": {
                  "678_percentageee_unique": {
                      "name": "678_percentageee_unique",
                      "columns": [
                          "percentageee"
                      ]
                  },
                  "_pgroll_new_678_xata_id_key": {
                      "name": "_pgroll_new_678_xata_id_key",
                      "columns": [
                          "xata_id"
                      ]
                  }
              },
              "comment": "",
              "oid": "4564039",
              "columns": [
                  {
                      "name": "percentageee",
                      "type": "float",
                      "pgType": "double precision",
                      "notNull": true,
                      "unique": true,
                      "defaultValue": null
                  },
                  {
                      "name": "pricer",
                      "type": "float",
                      "pgType": "double precision",
                      "notNull": false,
                      "unique": false,
                      "defaultValue": null
                  },
                  {
                      "name": "symbolll",
                      "type": "string",
                      "pgType": "text",
                      "notNull": false,
                      "unique": false,
                      "defaultValue": null
                  },
                  {
                      "name": "timestamp",
                      "type": "datetime",
                      "pgType": "timestamptz",
                      "notNull": false,
                      "unique": false,
                      "defaultValue": null
                  },
                  {
                      "name": "xata_createdat",
                      "type": "datetime",
                      "pgType": "timestamptz",
                      "notNull": true,
                      "unique": false,
                      "defaultValue": "now()"
                  },
                  {
                      "name": "xata_id",
                      "type": "text",
                      "pgType": "text",
                      "notNull": true,
                      "unique": true,
                      "defaultValue": "('rec_'::text || (xata_private.xid())::text)"
                  },
                  {
                      "name": "xata_updatedat",
                      "type": "datetime",
                      "pgType": "timestamptz",
                      "notNull": true,
                      "unique": false,
                      "defaultValue": "now()"
                  },
                  {
                      "name": "xata_version",
                      "type": "int",
                      "pgType": "integer",
                      "notNull": true,
                      "unique": false,
                      "defaultValue": "0"
                  }
              ]
          },
        ]
    }
  }
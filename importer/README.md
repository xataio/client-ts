# Importer

Read data from a file:

```bash
npx @xata.io/importer file.csv --columns "a,b,c" --table tableName
```

For reading data from stdin, use `-` as the file name

```bash
csv-generator-script | npx @xata.io/importer - --columns "a,b,c" --table tableName
```

Most flags are optional. If no `columns` are specified, the application will use the CSV headers as column names, normalizing them to remove whitespaces and using `pascalCase`.

If the CSV file has no header, use `--noheader` in order to interpret the first line as data.

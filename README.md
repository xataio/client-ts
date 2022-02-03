# Xata.io SDK for TypeScript and JavaScript

## Usage

Install the dependencies

```
npm install @xata.io/client
npm install @xata.io/codegen -D
```

Add an npm script to your package.json file to invoke `xata-codegen`. You can customize the location of the schema file and the generated output file. For example:

```json
{
  "scripts": {
    "xata-codegen": "xata-codegen -s xata/schema.json -o xata.ts"
  }
}
```

Run it (this is assuming your schema file is in `xata/schema.json` and it was created by the `xata` cli application)

```bash
npm run xata-codegen
```

In a TypeScript file start using the generated code:

```ts
import { XataClient } from './xata';

const client = new XataClient({
  url: 'https://myworkspace-123abc.xata.sh/db/databasename:branchname',
  token: 'xau_1234abcdef'
});
```

The import above will differ if you chose to genreate the types in a different location.

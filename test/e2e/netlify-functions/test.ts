import { XataClient } from 'https://cdn.skypack.dev/@xata.io/client?dts';

export default () => new Response(JSON.stringify(XataClient));

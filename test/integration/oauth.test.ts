import { describe, test } from 'vitest';
import { HostProvider, getHostUrl } from '../../packages/client/dist';

const host = process.env.XATA_API_PROVIDER ?? 'production';
const webHost = process.env.XATA_WEB_URL ?? 'https://app.xata.io';
const apiHost = getHostUrl(host as HostProvider, 'main');

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${process.env.XATA_API_KEY}`
};

type Scope = 'admin:all';

type OAuthClientDetails = {
  clientID: string;
  clientSecrets: string[];
  name?: string;
  description?: string;
  icon?: string;
  scopes?: Scope[];
  redirectURIs?: string[];
};

describe('OAuth API Smoke Test', () => {
  test('All actions', async ({ expect }) => {
    // Create client
    const createResponse = await fetch(`${webHost}/api/admin/oauth-clients`, {
      method: 'POST',
      body: JSON.stringify({
        client: { name: 'Test Client', description: 'Test client description', redirectURIs: ['https://example.com'] }
      }),
      headers
    });

    expect(createResponse.ok).toBe(true);
    const createdClient = await createResponse.json();
    const {
      client: { clientID }
    } = createdClient as { client: OAuthClientDetails };

    // List clients and check if the created client is there
    const listResponse1 = await fetch(`${webHost}/api/admin/oauth-clients`, { headers });
    expect(listResponse1.ok).toBe(true);

    const { clients: clients1 } = (await listResponse1.json()) as { clients: OAuthClientDetails[] };
    const isClientInList1 = clients1.find((client) => client.clientID === clientID);
    expect(isClientInList1).not.toBeUndefined();
    expect(isClientInList1?.name).toBe('Test Client');
    expect(isClientInList1?.description).toBe('Test client description');

    // Update client
    const updateResponse = await fetch(`${webHost}/api/admin/oauth-clients/${clientID}`, {
      method: 'PUT',
      body: JSON.stringify({
        client: {
          name: 'Updated Test Client',
          description: 'Updated test client description',
          redirectURIs: ['https://example.com', 'https://example2.com']
        }
      }),
      headers
    });
    expect(updateResponse.ok).toBe(true);

    // List clients and check if the updated client is there
    const listResponse2 = await fetch(`${webHost}/api/admin/oauth-clients`, { headers });
    expect(listResponse2.ok).toBe(true);

    const { clients: clients2 } = (await listResponse2.json()) as { clients: OAuthClientDetails[] };
    const isClientInList2 = clients2.find((client) => client.clientID === clientID);
    expect(isClientInList2).not.toBeUndefined();
    expect(isClientInList2?.name).toBe('Updated Test Client');
    expect(isClientInList2?.description).toBe('Updated test client description');

    // Generate secret for the client
    const generateSecretResponse = await fetch(`${webHost}/api/admin/oauth-clients/${clientID}/secret`, {
      method: 'POST',
      headers
    });
    expect(generateSecretResponse.ok).toBe(true);

    const { secret } = (await generateSecretResponse.json()) as { secret: string };
    expect(secret).not.toBeUndefined();
    expect(secret).toBeTypeOf('string');
    expect(secret.length).toBeGreaterThan(0);

    // Generate a code for the user
    const codeResponse = await fetch(`${apiHost}/oauth/authorize`, {
      method: 'POST',
      body: JSON.stringify({
        clientId: clientID,
        redirectUri: 'https://example.com',
        responseType: 'code'
      }),
      headers
    });

    expect(codeResponse.ok).toBe(true);
    const { code } = (await codeResponse.json()) as { code: string };

    // Get a JWT token with the client ID and secret
    const tokenResponse = await fetch(`${webHost}/api/integrations/oauth/token`, {
      method: 'POST',
      body: JSON.stringify({
        client_id: clientID,
        client_secret: secret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'https://example.com'
      }),
      headers
    });

    expect(tokenResponse.ok).toBe(true);
    const { access_token } = (await tokenResponse.json()) as { access_token: string };

    expect(access_token).not.toBeUndefined();
    expect(access_token).toBeTypeOf('string');
    expect(access_token.length).toBeGreaterThan(0);

    // Delete client
    const deleteResponse = await fetch(`${webHost}/api/admin/oauth-clients/${clientID}`, {
      method: 'DELETE',
      headers
    });
    expect(deleteResponse.ok).toBe(true);

    // List clients again and check if the created client is not there
    const listResponse3 = await fetch(`${webHost}/api/admin/oauth-clients`, { headers });
    expect(listResponse3.ok).toBe(true);

    const { clients: clients3 } = (await listResponse3.json()) as { clients: OAuthClientDetails[] };
    const isClientInList3 = clients3.find((client) => client.clientID === clientID);
    expect(isClientInList3).toBeUndefined();
  });
});

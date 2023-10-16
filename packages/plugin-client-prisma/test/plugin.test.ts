import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { getXataClient } from './src/xata'; // Generated client
import { PrismaXataHTTP, XataClient } from '../src/driver';
import { PrismaClient } from '@prisma/client';

const getXataClientWithPlugin = async () => {
  const xata = getXataClient();
  return xata as unknown as XataClient;
};

const xata = await getXataClientWithPlugin();
const adapter = new PrismaXataHTTP(xata, xata.schema.tables);
const prisma = new PrismaClient({ adapter });

const data = {
  email: 'email',
  id: 'id',
  name: 'name'
};

// Skipping for now because generate functions would need to be called
// Should pass locally with matching schemas
describe.skip('@xata.io/prisma plugin', () => {
  beforeAll(async () => {
    await prisma.user.create({
      data
    });
    await prisma.post.create({
      data: {
        ...data,
        bool: true,
        float: 2.2324,
        int: 44,
        json: {
          hello: 'world'
        },
        // With this, the link object in Xata is not populated
        // So if using this plugin we could suggest just not using links?
        // connect or create is not supported anyways because it involves transactions.
        //https://github.com/prisma/prisma-engines/blob/main/query-engine/driver-adapters/js/adapter-neon/src/neon.ts#L159
        authorId: 'id',
        datetime: new Date()
      }
    });
  });
  afterAll(async () => {
    await prisma.post.deleteMany({});
    await prisma.user.deleteMany({});
  });
  test('can query one', async () => {
    const res = await prisma.post.findFirst({});
    expect(res).toHaveProperty('id');
  });
  test('can query many', async () => {
    const res = await prisma.post.findMany();
    expect(res[0]).toHaveProperty('id');
  });
  test('can order', async () => {
    const res = await prisma.user.findMany({
      orderBy: {
        email: 'asc'
      }
    });
    expect(res[0]).toHaveProperty('id');
  });
  test('can filter', async () => {
    const res = await prisma.user.findMany({
      where: {
        email: {
          startsWith: 'e'
        }
      }
    });
    expect(res[0]).toHaveProperty('id');
  });
  test('can query relations on user', async () => {
    const res = await prisma.user.findFirst({
      include: {
        posts: true
      }
    });
    expect(res).toHaveProperty('posts');
    expect(res?.posts).toHaveLength(1);
  });
  test('can query relations on post', async () => {
    const res = await prisma.post.findFirst({
      include: {
        author: true
      }
    });
    expect(res).toHaveProperty('author');
    expect(res?.author).toHaveProperty('id');
  });
  // TODO try many to many
  test('can filter on relations', async () => {
    const res = await prisma.post.findFirst({
      where: {
        author: {
          id: 'id'
        }
      },
      include: {
        author: true
      }
    });

    expect(res).toHaveProperty('author');
    expect(res?.author).toHaveProperty('id');
    expect(res?.author?.id).toBe('id');
  });
  test.skip('can filter on relations', async () => {
    const res = await prisma.user.findFirst({
      select: {
        // aggregations don't work
        _count: true
      }
    });

    expect(res).toHaveProperty('author');
    expect(res?._count).toHaveProperty('id');
  });
});

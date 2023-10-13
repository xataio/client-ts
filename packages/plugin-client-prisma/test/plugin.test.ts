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
  email: 'test',
  id: 'test',
  name: 'test'
};

// Skipping for now because generate functions would need to be called
describe.skip('@xata.io/prisma plugin', () => {
  beforeAll(async () => {
    await prisma.post.create({
      data
    });
    await prisma.user.create({
      data
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
          startsWith: 't'
        }
      }
    });
    expect(res[0]).toHaveProperty('id');
  });
  test('can query relations', async () => {
    const res = await prisma.user.findFirst({
      include: {
        posts: true
      }
    });
    expect(res).toHaveProperty('posts');
  });
});

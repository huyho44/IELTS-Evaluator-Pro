import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  const userId = '91ea8459-6687-4d99-9a7d-90e0373d9270';
  let prisma: {
    user: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
    };
  };
  let service: UsersService;

  beforeEach(() => {
    prisma = {
      user: { findMany: vi.fn(), findUnique: vi.fn() },
    };
    service = new UsersService(prisma as unknown as PrismaService);
  });

  it('returns every assigned role and a numeric target band without exposing credentials', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: userId,
        email: 'teacher@example.com',
        status: 'ACTIVE',
        targetBand: new Prisma.Decimal('6.5'),
        passwordHash: 'must-not-be-returned',
        userRoles: [
          { role: { code: 'LEARNER' } },
          { role: { code: 'INSTRUCTOR' } },
        ],
      },
    ]);

    expect(await service.findAll()).toEqual([
      {
        id: userId,
        email: 'teacher@example.com',
        status: 'ACTIVE',
        targetBand: 6.5,
        roles: ['LEARNER', 'INSTRUCTOR'],
      },
    ]);
    const query = prisma.user.findMany.mock.calls[0][0];
    expect(query.select).not.toHaveProperty('passwordHash');
    expect(query.select).not.toHaveProperty('role');
  });

  it('looks up a UUID and supports an unset target and no assigned roles', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: userId,
      email: 'learner@example.com',
      status: 'ACTIVE',
      targetBand: null,
      userRoles: [],
    });

    expect(await service.findOne(userId)).toEqual({
      id: userId,
      email: 'learner@example.com',
      status: 'ACTIVE',
      targetBand: null,
      roles: [],
    });
    expect(prisma.user.findUnique.mock.calls[0][0].where).toEqual({ id: userId });
  });

  it('preserves a null result for a missing user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    expect(await service.findOne(userId)).toBeNull();
  });
});

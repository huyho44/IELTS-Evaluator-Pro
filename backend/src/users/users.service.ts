import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';

const publicUserSelect = {
  id: true,
  email: true,
  status: true,
  targetBand: true,
  userRoles: {
    select: {
      role: { select: { code: true } },
    },
  },
} satisfies Prisma.UserSelect;

type SelectedUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

function toPublicUser(user: SelectedUser) {
  return {
    id: user.id,
    email: user.email,
    status: user.status,
    targetBand: user.targetBand?.toNumber() ?? null,
    roles: user.userRoles.map(({ role }) => role.code),
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      select: publicUserSelect,
    });
    return users.map(toPublicUser);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: publicUserSelect,
    });
    return user ? toPublicUser(user) : null;
  }
}

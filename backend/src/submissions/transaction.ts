import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma.service.js';
// Retry only transactions whose entire callback is database-local and safe to replay.
export async function serializable<T>(
  db: PrismaService,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(work, {
        isolationLevel: 'Serializable',
        maxWait: 5000,
        timeout: 20000,
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        !['P2034', 'P2002'].includes(error.code)
      )
        throw error;
      if (attempt >= 2)
        throw new ConflictException('Concurrent update; reload and retry');
    }
  }
}

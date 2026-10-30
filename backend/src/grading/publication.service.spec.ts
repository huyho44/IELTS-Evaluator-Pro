import type { Prisma } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma.service.js';
import { PublicationService } from './publication.service.js';

const NOW = new Date('2026-10-30T09:00:00.000Z');
const EARLIER = new Date('2026-10-29T09:00:00.000Z');

type AcceptedRow = {
  id: string;
  revisionId: string;
  resultId: string;
  acceptedAt: Date;
  releaseAfter: Date | null;
  publishedAt: Date | null;
  isCurrent: boolean;
  supersedesId: string | null;
  result: {
    revision: { attempt: { learnerId: string } };
    skillObservations: { id: string }[];
  };
};
type RowWhere = {
  revisionId?: string;
  publishedAt?: null;
  releaseAfter?: { lte: Date };
  acceptedAt?: Date | { lte?: Date; gt?: Date };
  id?: { gt: string };
  isCurrent?: boolean;
  OR?: RowWhere[];
};
type RowOrder = { acceptedAt?: 'asc' | 'desc'; id?: 'asc' | 'desc' };
type Query = {
  where?: RowWhere;
  orderBy?: RowOrder | RowOrder[];
  take?: number;
  skip?: number;
};

function accepted(
  sequence: number,
  overrides: Partial<AcceptedRow> = {},
): AcceptedRow {
  const id = `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
  return {
    id,
    revisionId: `revision-${sequence}`,
    resultId: `result-${sequence}`,
    acceptedAt: EARLIER,
    releaseAfter: EARLIER,
    publishedAt: null,
    isCurrent: false,
    supersedesId: null,
    result: {
      revision: { attempt: { learnerId: 'learner' } },
      skillObservations: [{ id: `observation-${sequence}` }],
    },
    ...overrides,
  };
}

function matches(row: AcceptedRow, where: RowWhere = {}): boolean {
  if (where.revisionId !== undefined && row.revisionId !== where.revisionId)
    return false;
  if (where.publishedAt === null && row.publishedAt !== null) return false;
  if (
    where.releaseAfter &&
    (!row.releaseAfter || row.releaseAfter > where.releaseAfter.lte)
  )
    return false;
  if (where.acceptedAt instanceof Date) {
    if (+row.acceptedAt !== +where.acceptedAt) return false;
  } else if (where.acceptedAt) {
    if (where.acceptedAt.lte && row.acceptedAt > where.acceptedAt.lte)
      return false;
    if (where.acceptedAt.gt && row.acceptedAt <= where.acceptedAt.gt)
      return false;
  }
  if (where.id && row.id <= where.id.gt) return false;
  if (where.isCurrent !== undefined && row.isCurrent !== where.isCurrent)
    return false;
  return !where.OR || where.OR.some((condition) => matches(row, condition));
}

// Only the database is replaced: every test exercises the real publish() and its guards.
function fixture(
  rows: AcceptedRow[],
  beforeSweepQuery?: (index: number) => void,
) {
  const sweepQueries: Query[] = [];
  const evidence = new Map<string, unknown>();
  const db = {
    acceptedAssessment: {
      findMany: vi.fn(async (query: Query) => {
        if (!query.where?.revisionId) {
          beforeSweepQuery?.(sweepQueries.length);
          sweepQueries.push(query);
        }
        const orders = Array.isArray(query.orderBy)
          ? query.orderBy
          : [query.orderBy ?? {}];
        const selected = rows.filter((row) => matches(row, query.where));
        selected.sort((a, b) => {
          for (const order of orders) {
            if (order.acceptedAt && +a.acceptedAt !== +b.acceptedAt)
              return (
                (+a.acceptedAt - +b.acceptedAt) *
                (order.acceptedAt === 'asc' ? 1 : -1)
              );
            if (order.id && a.id !== b.id)
              return (a.id < b.id ? -1 : 1) * (order.id === 'asc' ? 1 : -1);
          }
          return 0;
        });
        const skip = query.skip ?? 0;
        return structuredClone(
          selected.slice(
            skip,
            query.take === undefined ? undefined : skip + query.take,
          ),
        );
      }),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        const row = rows.find((item) => item.id === where.id);
        if (!row) throw new Error('Accepted assessment not found');
        return structuredClone(row);
      }),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: RowWhere;
          data: Partial<AcceptedRow>;
        }) => {
          const selected = rows.filter((row) => matches(row, where));
          for (const row of selected) Object.assign(row, data);
          return { count: selected.length };
        },
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<AcceptedRow>;
        }) => {
          const row = rows.find((item) => item.id === where.id);
          if (!row) throw new Error('Accepted assessment not found');
          Object.assign(row, data);
          return structuredClone(row);
        },
      ),
    },
    skillEvidence: {
      upsert: vi.fn(
        async ({
          where,
          create,
        }: {
          where: {
            acceptedId_observationId: {
              acceptedId: string;
              observationId: string;
            };
          };
          create: unknown;
        }) => {
          const key = `${where.acceptedId_observationId.acceptedId}:${where.acceptedId_observationId.observationId}`;
          if (!evidence.has(key)) evidence.set(key, create);
          return evidence.get(key);
        },
      ),
    },
    outboxEvent: { create: vi.fn(async ({ data }: { data: unknown }) => data) },
    notification: {
      create: vi.fn(async ({ data }: { data: unknown }) => data),
    },
    $transaction: vi.fn(
      async (
        work: (tx: Prisma.TransactionClient) => Promise<unknown>,
        _options?: { isolationLevel: string },
      ): Promise<unknown> => work(db as unknown as Prisma.TransactionClient),
    ),
  };
  return {
    service: new PublicationService(db as unknown as PrismaService),
    tx: db as unknown as Prisma.TransactionClient,
    db,
    evidence,
    sweepQueries,
  };
}

describe('PublicationService durable publication sweep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('reaches the 51st result past 50 obsolete decisions with tied acceptedAt without changing their history', async () => {
    const obsolete = Array.from({ length: 50 }, (_, index) =>
      accepted(index + 1),
    );
    const replacements = obsolete.map((old, index) =>
      accepted(1001 + index, {
        revisionId: old.revisionId,
        supersedesId: old.id,
        publishedAt: EARLIER,
        isCurrent: true,
      }),
    );
    const ready = accepted(51);
    const { service, db, sweepQueries } = fixture([
      ...obsolete,
      ready,
      ...replacements,
    ]);

    await service.publishDue();

    expect(ready).toMatchObject({ publishedAt: NOW, isCurrent: true });
    for (const old of obsolete) {
      expect(old).toMatchObject({
        publishedAt: null,
        releaseAfter: EARLIER,
        isCurrent: false,
      });
    }
    expect(
      replacements.every((row) => row.isCurrent && row.publishedAt === EARLIER),
    ).toBe(true);
    expect(db.outboxEvent.create).toHaveBeenCalledTimes(1);
    expect(db.notification.create).toHaveBeenCalledTimes(1);
    expect(db.skillEvidence.upsert).toHaveBeenCalledTimes(1);
    expect(sweepQueries[0].orderBy).toEqual([
      { acceptedAt: 'asc' },
      { id: 'asc' },
    ]);
    expect(sweepQueries[1].where?.OR).toEqual([
      { acceptedAt: { gt: EARLIER } },
      { acceptedAt: EARLIER, id: { gt: obsolete[49].id } },
    ]);
  });

  it('publishes all 120 results while successful publications shrink the pending set', async () => {
    const rows = Array.from({ length: 120 }, (_, index) =>
      accepted(index + 1, {
        acceptedAt: new Date(+EARLIER + Math.floor(index / 20)),
      }),
    );
    const { service, db, evidence } = fixture(rows);

    await service.publishDue();
    expect(
      rows.every((row) => row.isCurrent && +row.publishedAt! === +NOW),
    ).toBe(true);
    expect(evidence.size).toBe(120);

    await service.publishDue();

    expect(db.outboxEvent.create).toHaveBeenCalledTimes(120);
    expect(db.notification.create).toHaveBeenCalledTimes(120);
    expect(
      db.$transaction.mock.calls.every(
        ([, options]) =>
          (options as { isolationLevel: string }).isolationLevel ===
          'Serializable',
      ),
    ).toBe(true);
  });

  it('uses one cutoff across batches and leaves manual, future and newly accepted decisions private', async () => {
    const ready = Array.from({ length: 50 }, (_, index) => accepted(index + 1));
    const future = new Date(+NOW + 30_000);
    const manual = accepted(51, { releaseAfter: null });
    const scheduled = accepted(52, { releaseAfter: future });
    const laterAccepted = accepted(53, { acceptedAt: future });
    const { service, db, sweepQueries } = fixture(
      [...ready, manual, scheduled, laterAccepted],
      (index) => {
        if (index === 1) vi.setSystemTime(new Date(+NOW + 60_000));
      },
    );

    await service.publishDue();

    expect(db.notification.create).toHaveBeenCalledTimes(50);
    expect(
      [manual, scheduled, laterAccepted].every(
        (row) => row.publishedAt === null,
      ),
    ).toBe(true);
    expect(
      sweepQueries.every((query) => +query.where!.releaseAfter!.lte === +NOW),
    ).toBe(true);
    expect(
      sweepQueries.every(
        (query) => +(query.where!.acceptedAt as { lte: Date }).lte === +NOW,
      ),
    ).toBe(true);

    await service.publishDue();

    expect(manual.publishedAt).toBeNull();
    expect(scheduled.isCurrent).toBe(true);
    expect(laterAccepted.isCurrent).toBe(true);
    expect(db.notification.create).toHaveBeenCalledTimes(52);
  });

  it('cannot undo a published descendant through an unpublished intermediate decision', async () => {
    const oldest = accepted(1);
    const middle = accepted(2, {
      revisionId: oldest.revisionId,
      supersedesId: oldest.id,
    });
    const newest = accepted(3, {
      revisionId: oldest.revisionId,
      supersedesId: middle.id,
      publishedAt: EARLIER,
      isCurrent: true,
    });
    const { service, tx, db } = fixture([oldest, middle, newest]);

    await service.publishDue();
    await service.publish(tx, oldest.id);
    await service.publish(tx, middle.id);
    await service.publish(tx, newest.id);

    expect(newest).toMatchObject({ publishedAt: EARLIER, isCurrent: true });
    expect(
      [oldest, middle].every(
        (row) => row.publishedAt === null && row.releaseAfter === EARLIER,
      ),
    ).toBe(true);
    expect(db.acceptedAssessment.update).not.toHaveBeenCalled();
    expect(db.skillEvidence.upsert).not.toHaveBeenCalled();
    expect(db.outboxEvent.create).not.toHaveBeenCalled();
    expect(db.notification.create).not.toHaveBeenCalled();
  });

  it('keeps the published assessment current until its replacement is due, then publishes only once', async () => {
    const current = accepted(1, { publishedAt: EARLIER, isCurrent: true });
    const replacement = accepted(2, {
      revisionId: current.revisionId,
      supersedesId: current.id,
      releaseAfter: new Date(+NOW + 60_000),
    });
    const { service, tx, db, evidence } = fixture([current, replacement]);
    evidence.set('existing', { acceptedId: current.id });

    await service.publishDue();

    expect(current.isCurrent).toBe(true);
    expect(replacement.publishedAt).toBeNull();
    expect(evidence.size).toBe(1);
    expect(db.notification.create).not.toHaveBeenCalled();

    vi.setSystemTime(replacement.releaseAfter!);
    await service.publishDue();
    await service.publishDue();
    await service.publish(tx, replacement.id);

    expect(current).toMatchObject({ isCurrent: false, publishedAt: EARLIER });
    expect(replacement).toMatchObject({
      isCurrent: true,
      publishedAt: replacement.releaseAfter,
    });
    expect(evidence.get('existing')).toEqual({ acceptedId: current.id });
    expect(evidence.size).toBe(2);
    expect(db.notification.create).toHaveBeenCalledTimes(1);
    expect(db.outboxEvent.create).toHaveBeenCalledTimes(1);
    expect(db.skillEvidence.upsert).toHaveBeenCalledTimes(1);
  });
});

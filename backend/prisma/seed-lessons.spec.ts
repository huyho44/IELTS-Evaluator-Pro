import { describe, expect, it } from 'vitest';
import type { Prisma } from '@prisma/client';
import { seedLessons } from './seed-lessons.js';

// In-memory delegates exercise fixture creation, API IDs and conflict handling.
function database() {
  const chapters: any[] = [];
  const items: any[] = [];
  const tx = {
    chapter: {
      findMany: async ({ where }: any) => chapters.filter((c) =>
        c.id === where.OR[0].id || (c.courseId === where.OR[1].courseId &&
          (c.title === where.OR[1].OR[0].title || c.position === where.OR[1].OR[1].position))),
      create: async ({ data }: any) => { chapters.push(data); return data; },
    },
    learningItem: {
      findMany: async ({ where }: any) => items.filter((i) =>
        i.id === where.OR[0].id || (i.courseId === where.OR[1].courseId &&
          (i.title === where.OR[1].OR[0].title || i.position === where.OR[1].OR[1].position))),
      create: async ({ data }: any) => {
        const { lesson, ...item } = data;
        items.push({ ...item, lesson: { summary: lesson.create.summary, lessonMaterials: [
          { ...lesson.create.lessonMaterials.create, externalUrl: null, fileAssetId: null },
        ] } });
      },
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, chapters, items };
}
const fixtureId = (n: number) => `fixture-${n}`;

describe('demo lesson seed', () => {
  it('creates the graph once and reuses API IDs on rerun', async () => {
    const { tx, chapters, items } = database();
    await seedLessons(tx, 'course', fixtureId);
    expect(chapters).toHaveLength(2);
    expect(items).toHaveLength(2);
    chapters[0].id = 'api-chapter';
    items[0].chapterId = 'api-chapter';
    items[0].id = 'api-lesson';
    items[0].lesson.lessonMaterials[0].id = 'api-material';
    const before = JSON.stringify({ chapters, items });
    await seedLessons(tx, 'course', fixtureId);
    expect(JSON.stringify({ chapters, items })).toBe(before);
  });

  it('rejects multiple matches instead of picking the first title', async () => {
    const { tx, items } = database();
    await seedLessons(tx, 'course', fixtureId);
    items.push({ ...items[0], id: 'duplicate' });
    await expect(seedLessons(tx, 'course', fixtureId)).rejects.toThrow('Demo lesson conflict');
  });

  it('preserves edited content and rejects occupied chapter positions', async () => {
    const { tx, items, chapters } = database();
    await seedLessons(tx, 'course', fixtureId);
    items[0].lesson.lessonMaterials[0].contentText = 'Edited locally';
    await expect(seedLessons(tx, 'course', fixtureId)).rejects.toThrow('Demo lesson conflict');
    expect(items[0].lesson.lessonMaterials[0].contentText).toBe('Edited locally');
    chapters[0].title = 'Another chapter';
    await expect(seedLessons(tx, 'course', fixtureId)).rejects.toThrow('Demo chapter conflict');
  });
});

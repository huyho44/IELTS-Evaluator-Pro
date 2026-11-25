import type { Prisma } from '@prisma/client';

// A learning item is visible to learners when it is published and its chapter
// (if any) is published too. Hiding a chapter hides every item inside it.
export const visibleItemWhere = {
  status: 'PUBLISHED',
  OR: [{ chapterId: null }, { chapter: { status: 'PUBLISHED' } }],
} satisfies Prisma.LearningItemWhereInput;

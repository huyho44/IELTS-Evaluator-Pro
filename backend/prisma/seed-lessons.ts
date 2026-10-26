import type { Prisma } from '@prisma/client';

const samples = [
  {
    chapterTitle: '[FE Demo] Reading basics', chapterPosition: 1, position: 10,
    title: '[FE Demo] Skimming for the main idea',
    summary: 'Learn how to identify the main idea of a passage.',
    contentText: 'Skimming for the main idea\n\nSkimming means reading quickly to understand the general meaning.\n\n1. Read the title.\n2. Read the first sentence of each paragraph.\n3. Look for repeated words and ideas.\n4. Do not stop at every unfamiliar word.\n\nExample:\nA paragraph mentions buses, trains and cycling.\nIts main idea may be transport.\n\nBefore answering detailed questions, summarize the passage in one sentence.',
  },
  {
    chapterTitle: '[FE Demo] Finding details', chapterPosition: 2, position: 20,
    title: '[FE Demo] Scanning for specific information',
    summary: 'Practice finding names, dates and numbers.',
    contentText: 'Scanning for specific information\n\nScanning means looking for a particular piece of information.\n\n1. Read the question first.\n2. Identify the name, date, number or keyword you need.\n3. Scan the passage to locate that information.\n4. Check the surrounding sentence.\n\nExample:\nQuestion: What time does the library open?\nPassage: The library opens at 9 a.m. on weekdays.\nAnswer: 9 a.m.\n\nAlways check the word limit before writing your answer.',
  },
];

// Called inside the main seed transaction: conflicts roll back the entire seed.
export async function seedLessons(
  tx: Prisma.TransactionClient, courseId: string, fixtureId: (sequence: number) => string,
) {
  for (const [index, sample] of samples.entries()) {
    const chapterId = fixtureId(100 + index);
    const lessonId = fixtureId(110 + index);
    const chapters = await tx.chapter.findMany({
      where: { OR: [{ id: chapterId }, { courseId, OR: [
        { title: sample.chapterTitle }, { position: sample.chapterPosition },
      ] }] },
    });
    if (chapters.length > 1 || chapters.some((chapter) =>
      chapter.courseId !== courseId || chapter.title !== sample.chapterTitle ||
      chapter.position !== sample.chapterPosition)) {
      throw new Error(`Demo chapter conflict at position ${sample.chapterPosition}`);
    }
    const chapter = chapters[0] ?? await tx.chapter.create({
      data: { id: chapterId, courseId, title: sample.chapterTitle, position: sample.chapterPosition },
    });
    const candidates = await tx.learningItem.findMany({
      where: { OR: [{ id: lessonId }, { courseId, OR: [
        { title: sample.title }, { position: sample.position },
      ] }] },
      include: { lesson: { include: { lessonMaterials: true } } },
    });
    if (candidates.length > 1 || candidates.some((item) => {
      const materials = item.lesson?.lessonMaterials;
      const material = materials?.[0];
      return item.courseId !== courseId || item.chapterId !== chapter.id ||
        item.kind !== 'LESSON' || item.title !== sample.title ||
        item.position !== sample.position || item.status !== 'PUBLISHED' ||
        item.lesson?.summary !== sample.summary || materials?.length !== 1 ||
        material?.kind !== 'TEXT' || material.position !== 1 ||
        material.contentText !== sample.contentText || material.externalUrl !== null ||
        material.fileAssetId !== null;
    })) {
      throw new Error(`Demo lesson conflict at position ${sample.position}`);
    }
    if (candidates.length === 0) {
      await tx.learningItem.create({
        data: {
          id: lessonId, courseId, chapterId: chapter.id, kind: 'LESSON',
          title: sample.title, position: sample.position, status: 'PUBLISHED',
          lesson: { create: { summary: sample.summary, lessonMaterials: { create: {
            id: fixtureId(120 + index), kind: 'TEXT', position: 1, contentText: sample.contentText,
          } } } },
        },
      });
    }
  }
}

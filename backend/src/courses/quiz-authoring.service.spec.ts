import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { Actor } from '../auth/auth.service.js';
import { AccessService } from '../auth/access.service.js';
import type { PrismaService } from '../prisma.service.js';
import { QuizAuthoringService } from './quiz-authoring.service.js';

const actor = (id: string, roles: string[]): Actor => ({
  id,
  email: `${id}@test.example`,
  displayName: id,
  roles,
  targetBand: null,
  targetExamDate: null,
  status: 'ACTIVE',
});
const teacher = actor('teacher', ['INSTRUCTOR']);
const COURSE = '00000000-0000-4000-8000-000000000001';
const SKILL = '00000000-0000-4000-8000-000000000002';

function service(publishedSkills = 1) {
  const prisma = {
    courseInstructor: {
      findUnique: async ({ where }: { where: Record<string, any> }) =>
        where.courseId_instructorId.instructorId === teacher.id ? {} : null,
    },
    skill: { count: async () => publishedSkills },
    chapter: { findFirst: async () => null },
    $transaction: async () => {
      throw new Error('valid input reached the database');
    },
  } as unknown as PrismaService;
  return new QuizAuthoringService(prisma, new AccessService(prisma));
}

const valid = {
  title: 'Quiz',
  position: 1,
  skillArea: 'READING',
  promptText: 'Passage',
  instructions: 'Answer',
  skillIds: [SKILL],
  questions: [
    {
      type: 'SINGLE_CHOICE',
      prompt: 'Q1',
      options: [
        { text: 'A', correct: true },
        { text: 'B', correct: false },
      ],
    },
  ],
};
const withQuestion = (question: Record<string, unknown>) => ({
  ...valid,
  questions: [question],
});

describe('QuizAuthoringService validation', () => {
  it('refuses non-instructors', async () => {
    await expect(
      service().create(COURSE, valid, actor('x', ['INSTRUCTOR'])),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([
    ['writing area', { ...valid, skillArea: 'WRITING' }],
    ['no skills', { ...valid, skillIds: [] }],
    ['no questions', { ...valid, questions: [] }],
    ['unknown type', withQuestion({ type: 'ESSAY', prompt: 'Q' })],
    [
      'single choice with two answers',
      withQuestion({
        type: 'SINGLE_CHOICE',
        prompt: 'Q',
        options: [
          { text: 'A', correct: true },
          { text: 'B', correct: true },
        ],
      }),
    ],
    [
      'multiple choice without a correct option',
      withQuestion({
        type: 'MULTIPLE_CHOICE',
        prompt: 'Q',
        options: [
          { text: 'A', correct: false },
          { text: 'B', correct: false },
        ],
      }),
    ],
    [
      'one option',
      withQuestion({
        type: 'MULTIPLE_CHOICE',
        prompt: 'Q',
        options: [{ text: 'A', correct: true }],
      }),
    ],
    [
      'short answer without accepted answers',
      withQuestion({ type: 'SHORT_ANSWER', prompt: 'Q', acceptedAnswers: [] }),
    ],
    [
      'marks not in half steps',
      withQuestion({
        type: 'SHORT_ANSWER',
        prompt: 'Q',
        acceptedAnswers: ['x'],
        marks: 0.3,
      }),
    ],
  ])('rejects %s', async (_label, body) => {
    await expect(
      service().create(COURSE, body, teacher),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects skills that are unpublished or from another area', async () => {
    await expect(service(0).create(COURSE, valid, teacher)).rejects.toThrow(
      'Skills must be published READING skills',
    );
  });
});

import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma.service.js';
import { AccessService } from '../auth/access.service.js';
import type { Actor } from '../auth/auth.service.js';
import { integer, object, text, uuid } from '../auth/validation.js';
import { serializable } from '../submissions/transaction.js';
import { NotifierService } from '../notifications/notifier.service.js';

export const QUIZ_LIMITS = {
  questions: 50,
  options: 8,
  acceptedAnswers: 20,
} as const;
const AREAS = ['READING', 'LISTENING'] as const;
const TYPES = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SHORT_ANSWER'] as const;
type QuestionType = (typeof TYPES)[number];

type QuizQuestion = {
  type: QuestionType;
  prompt: string;
  marks: number;
  options: { text: string; correct: boolean }[];
  acceptedAnswers: string[];
  maxWords: number | null;
};

function marks(value: unknown) {
  if (value === undefined) return 1;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0.5 ||
    value > 10 ||
    !Number.isInteger(value * 2)
  )
    throw new BadRequestException(
      'marks must be from 0.5 to 10 in steps of 0.5',
    );
  return value;
}

// Parses one question; errors name the question number for the author.
function question(value: unknown, index: number): QuizQuestion {
  const label = `questions[${index + 1}]`;
  const dto = object(value);
  if (!TYPES.includes(dto.type as QuestionType))
    throw new BadRequestException(
      `${label}.type must be one of ${TYPES.join(', ')}`,
    );
  const type = dto.type as QuestionType;
  const prompt = text(dto.prompt, `${label}.prompt`, 2000);
  if (type === 'SHORT_ANSWER') {
    const answers = dto.acceptedAnswers;
    if (
      !Array.isArray(answers) ||
      !answers.length ||
      answers.length > QUIZ_LIMITS.acceptedAnswers
    )
      throw new BadRequestException(
        `${label}.acceptedAnswers must list 1-${QUIZ_LIMITS.acceptedAnswers} answers`,
      );
    const accepted = [
      ...new Set(
        answers.map((answer, i) =>
          text(answer, `${label}.acceptedAnswers[${i + 1}]`, 200),
        ),
      ),
    ];
    const maxWords =
      dto.maxWords === undefined || dto.maxWords === null
        ? null
        : integer(dto.maxWords, `${label}.maxWords`, 1, 20);
    return {
      type,
      prompt,
      marks: marks(dto.marks),
      options: [],
      acceptedAnswers: accepted,
      maxWords,
    };
  }
  const options = dto.options;
  if (
    !Array.isArray(options) ||
    options.length < 2 ||
    options.length > QUIZ_LIMITS.options
  )
    throw new BadRequestException(
      `${label}.options must list 2-${QUIZ_LIMITS.options} options`,
    );
  const parsed = options.map((option, i) => {
    const row = object(option);
    if (typeof row.correct !== 'boolean')
      throw new BadRequestException(
        `${label}.options[${i + 1}].correct must be a boolean`,
      );
    return {
      text: text(row.text, `${label}.options[${i + 1}].text`, 500),
      correct: row.correct,
    };
  });
  const correct = parsed.filter((option) => option.correct).length;
  if (type === 'SINGLE_CHOICE' ? correct !== 1 : correct < 1)
    throw new BadRequestException(
      type === 'SINGLE_CHOICE'
        ? `${label} must have exactly one correct option`
        : `${label} must have at least one correct option`,
    );
  return {
    type,
    prompt,
    marks: marks(dto.marks),
    options: parsed,
    acceptedAnswers: [],
    maxWords: null,
  };
}

// Instructor-authored auto-graded quiz (A9): a Reading or Listening practice
// with its questions and a published answer key, graded by the existing
// answer-key flow. Each question is linked to the measured skills so scores
// feed skill evidence like the seeded Reading practice.
@Injectable()
export class QuizAuthoringService {
  private readonly notifier: NotifierService;
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    notifier?: NotifierService,
  ) {
    this.notifier = notifier ?? new NotifierService(prisma);
  }

  // POST /courses/:id/quizzes
  async create(courseId: string, input: unknown, actor: Actor) {
    await this.access.instructor(actor, courseId);
    const dto = object(input);
    if (!AREAS.includes(dto.skillArea as (typeof AREAS)[number]))
      throw new BadRequestException('skillArea must be READING or LISTENING');
    const skillArea = dto.skillArea as (typeof AREAS)[number];
    const title = text(dto.title, 'title', 240);
    const position = integer(dto.position, 'position', 1);
    const sectionId =
      dto.sectionId == null ? null : uuid(dto.sectionId, 'sectionId');
    const promptText = text(dto.promptText, 'promptText', 20000);
    const instructions = text(dto.instructions, 'instructions', 2000);
    const difficulty = integer(dto.difficulty ?? 2, 'difficulty', 1, 5);
    const expectedMinutes = integer(
      dto.expectedMinutes ?? 10,
      'expectedMinutes',
      1,
      240,
    );
    if (
      !Array.isArray(dto.skillIds) ||
      !dto.skillIds.length ||
      dto.skillIds.length > 20
    )
      throw new BadRequestException('Provide 1-20 skillIds');
    const skillIds = [...new Set(dto.skillIds.map((s) => uuid(s, 'skillId')))];
    if (
      !Array.isArray(dto.questions) ||
      !dto.questions.length ||
      dto.questions.length > QUIZ_LIMITS.questions
    )
      throw new BadRequestException(
        `Provide 1-${QUIZ_LIMITS.questions} questions`,
      );
    const questions = dto.questions.map(question);
    if (
      (await this.prisma.skill.count({
        where: { id: { in: skillIds }, status: 'PUBLISHED', skillArea },
      })) !== skillIds.length
    )
      throw new BadRequestException(
        `Skills must be published ${skillArea} skills`,
      );
    if (
      sectionId &&
      !(await this.prisma.chapter.findFirst({
        where: { id: sectionId, courseId },
      }))
    )
      throw new BadRequestException('Section must belong to this course');

    const now = new Date();
    const result = await serializable(this.prisma, async (tx) => {
      const item = await tx.learningItem.create({
        data: {
          courseId,
          chapterId: sectionId,
          kind: 'PRACTICE',
          title,
          position,
          status: 'PUBLISHED',
          learningItemSkills: {
            create: skillIds.map((skillId) => ({
              skillId,
              purpose: 'PRACTISE',
            })),
          },
          practiceActivity: {
            create: {
              creatorId: actor.id,
              skillArea,
              responseMode: 'OBJECTIVE',
            },
          },
        },
      });
      const version = await tx.activityVersion.create({
        data: {
          activityId: item.id,
          promptText,
          instructions,
          difficulty,
          expectedMinutes,
          publishedAt: now,
          contentHash: createHash('sha256')
            .update(JSON.stringify({ promptText, instructions, questions }))
            .digest('hex'),
        },
      });
      const key = await tx.answerKeyVersion.create({
        data: { activityVersionId: version.id, versionNo: 1, publishedAt: now },
      });
      for (const [index, q] of questions.entries()) {
        const bank = await tx.question.create({
          data: {
            authorId: actor.id,
            skillArea,
            title:
              q.prompt.length > 240 ? `${q.prompt.slice(0, 239)}…` : q.prompt,
          },
        });
        const questionVersion = await tx.questionVersion.create({
          data: {
            questionId: bank.id,
            questionType: q.type,
            promptText: q.prompt,
            publishedAt: now,
          },
        });
        const options = [];
        for (const [i, option] of q.options.entries())
          options.push({
            correct: option.correct,
            row: await tx.questionOption.create({
              data: {
                questionVersionId: questionVersion.id,
                optionCode: String.fromCharCode(65 + i),
                contentText: option.text,
                position: i + 1,
              },
            }),
          });
        const assessmentItem = await tx.assessmentItem.create({
          data: {
            activityVersionId: version.id,
            questionVersionId: questionVersion.id,
            position: index + 1,
            maxMarks: q.marks,
            itemSkills: {
              create: skillIds.map((skillId) => ({ skillId })),
            },
          },
        });
        const entry = await tx.answerKeyEntry.create({
          data: {
            answerKeyVersionId: key.id,
            assessmentItemId: assessmentItem.id,
            ...(q.type === 'SHORT_ANSWER'
              ? {
                  acceptedTextsJson: q.acceptedAnswers,
                  gradingRuleJson: {
                    method: 'TEXT_EXACT',
                    trim: true,
                    caseSensitive: false,
                    collapseSpaces: true,
                    ...(q.maxWords ? { maxWords: q.maxWords } : {}),
                  },
                }
              : {
                  gradingRuleJson: {
                    method: 'EXACT_OPTION_SET',
                    partialCredit: false,
                  },
                }),
          },
        });
        const correct = options.filter((option) => option.correct);
        if (correct.length)
          await tx.answerKeyOption.createMany({
            data: correct.map((option) => ({
              entryId: entry.id,
              optionId: option.row.id,
            })),
          });
      }
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          action: 'QUIZ_CREATED',
          entityType: 'LearningItem',
          entityKey: item.id,
          afterJson: {
            courseId,
            skillArea,
            questions: questions.length,
            activityVersionId: version.id,
            answerKeyVersionId: key.id,
          },
        },
      });
      return {
        id: item.id,
        title: item.title,
        position: item.position,
        sectionId: item.chapterId,
        skillArea,
        activityVersionId: version.id,
        answerKeyVersionId: key.id,
        questionCount: questions.length,
        maxScore: questions.reduce((sum, q) => sum + q.marks, 0),
      };
    });
    await this.notifier.announce({
      courseId,
      key: result.id,
      title: `New practice: ${title}`,
      body: `A new ${skillArea.toLowerCase()} quiz "${title}" is available in your course.`,
      navigationPath: `/courses/${courseId}/practices/${result.id}`,
    });
    return result;
  }
}

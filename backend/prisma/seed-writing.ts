import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import {
  DEMO_CRITERIA,
  WRITING_INSTRUCTIONS,
  WRITING_SCHEMA,
} from '../src/evaluation/writing-contract.js';

export const writingId = (n: number) =>
  `30102026-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const writingSkills = [
  {
    code: 'demo.writing.position',
    name: 'State and maintain a position',
    observableDefinition:
      'States an answer to the question and maintains that position across the response.',
  },
  {
    code: 'demo.writing.development',
    name: 'Develop a supported argument',
    observableDefinition:
      'Explains why a claim holds and gives a relevant example or consequence.',
  },
  {
    code: 'demo.writing.progression',
    name: 'Order and connect ideas',
    observableDefinition:
      'Uses focused paragraphs and explicit logical relations to progress an argument.',
  },
  {
    code: 'demo.writing.reference',
    name: 'Make references unambiguous',
    observableDefinition:
      'Makes it clear which noun or idea a pronoun or demonstrative refers to.',
  },
  {
    code: 'demo.writing.collocation',
    name: 'Choose precise word combinations',
    observableDefinition:
      'Uses topic vocabulary and word combinations that express the intended meaning.',
  },
  {
    code: 'demo.writing.sentence-control',
    name: 'Control sentence boundaries',
    observableDefinition:
      'Separates complete clauses correctly and controls agreement in simple and complex sentences.',
  },
];
const transport =
  'Some people believe that governments should make public transport free. Others think users should pay for it. Discuss both views and give your opinion.';
export const writingActivities = [
  {
    title: 'Diagnostic: public transport',
    prompt: transport,
    instructions:
      'Write a complete Task 2 response of at least 250 words. Work independently. This diagnostic establishes evidence; unknown skills are not automatically weak.',
    skills: [0, 1, 2, 3, 4, 5],
    purpose: 'DIAGNOSTIC',
    difficulty: 2,
  },
  {
    title: 'Practice: develop one transport argument',
    prompt: transport,
    instructions:
      'Write a short Task 2 response with two developed body paragraphs. For each main claim add a reason, a specific example and an explanation linking it to your position. Feedback is practice feedback, not an official test band.',
    skills: [1],
    purpose: 'PRACTISE',
    difficulty: 2,
  },
  {
    title: 'Practice: progression and clear references',
    prompt: transport,
    instructions:
      'Write a Task 2 response. Give each paragraph one central idea. Use explicit logical connections and make every use of this, it and they unambiguous.',
    skills: [2, 3],
    purpose: 'PRACTISE',
    difficulty: 2,
  },
  {
    title: 'Practice: precise vocabulary and sentence control',
    prompt: transport,
    instructions:
      'Write a Task 2 response. Check topic word combinations, agreement, punctuation and clause boundaries. Prefer an accurate expression to an unfamiliar impressive word.',
    skills: [4, 5],
    purpose: 'PRACTISE',
    difficulty: 2,
  },
  {
    title: 'Rewrite: revise your transport response',
    prompt: transport,
    instructions:
      'After the diagnostic, use the Rewrite action on that original attempt so revisions remain linked. This separate guided activity is optional additional practice and must not be counted as an independent transfer test. Address the teacher-accepted observations and explain your changes to your teacher.',
    skills: [1, 2, 3],
    purpose: 'REWRITE',
    difficulty: 3,
  },
  {
    title: 'Transfer: remote work on a new topic',
    prompt:
      'Some employers allow their staff to work from home. Others require everyone to work in an office. Discuss both approaches and give your opinion.',
    instructions:
      'Write at least 250 words independently on this new topic. Apply the skills practised in the clinic. A teacher should inspect this new opportunity separately from revisions of the original transport task.',
    skills: [0, 1, 2, 3, 4, 5],
    purpose: 'TRANSFER',
    difficulty: 3,
  },
];

// Called inside seed.ts's transaction. Empty updates preserve existing records and real work.
export async function seedWriting(
  tx: Prisma.TransactionClient,
  teacherId: string,
  learnerIds: string[],
) {
  const course = await tx.course.upsert({
    where: { id: writingId(1) },
    update: {},
    create: {
      id: writingId(1),
      creatorId: teacherId,
      title: '[Demo] Writing Clinic: evidence to transfer',
      description:
        'Teaching materials and a complete practice workflow. Demo rubric descriptors are original teaching examples, not official or calibrated IELTS scoring.',
      status: 'PUBLISHED',
      enrollmentOpen: true,
      completionPolicyJson: { mode: 'ALL_REQUIRED_ITEMS' },
    },
  });
  if (course.creatorId !== teacherId)
    throw new Error('Writing demo course ID is occupied');
  await tx.courseInstructor.upsert({
    where: {
      courseId_instructorId: { courseId: course.id, instructorId: teacherId },
    },
    update: {},
    create: {
      courseId: course.id,
      instructorId: teacherId,
      responsibility: 'OWNER',
    },
  });
  for (const learnerId of learnerIds)
    await tx.enrollment.upsert({
      where: { learnerId_courseId: { learnerId, courseId: course.id } },
      update: {},
      create: { learnerId, courseId: course.id, status: 'ACTIVE' },
    });
  const skills = [];
  for (const [index, sample] of writingSkills.entries())
    skills.push(
      await tx.skill.upsert({
        where: { code: sample.code },
        update: {},
        create: {
          id: writingId(10 + index),
          ...sample,
          skillArea: 'WRITING',
          status: 'PUBLISHED',
        },
      }),
    );
  await tx.skillPrerequisite.upsert({
    where: {
      skillId_prerequisiteSkillId: {
        skillId: skills[1].id,
        prerequisiteSkillId: skills[0].id,
      },
    },
    update: {},
    create: {
      skillId: skills[1].id,
      prerequisiteSkillId: skills[0].id,
      minStrength: 0.5,
      minSupport: 0.33,
    },
  });
  const rubric = await tx.rubricVersion.upsert({
    where: {
      rubricCode_versionNo: {
        rubricCode: 'DEMO_WRITING_CLINIC_TASK2',
        versionNo: 1,
      },
    },
    update: {},
    create: {
      id: writingId(30),
      rubricCode: 'DEMO_WRITING_CLINIC_TASK2',
      versionNo: 1,
      taskType: 'WRITING_TASK_2',
      title: '[Demo teaching rubric] Task 2; not official IELTS descriptors',
      publishedAt: new Date(),
    },
  });
  for (const [index, criterion] of DEMO_CRITERIA.entries()) {
    const row = await tx.rubricCriterion.upsert({
      where: {
        rubricVersionId_code: {
          rubricVersionId: rubric.id,
          code: criterion.code,
        },
      },
      update: {},
      create: {
        id: writingId(31 + index),
        rubricVersionId: rubric.id,
        ...criterion,
        weight: 0.25,
        maxScore: 9,
      },
    });
    for (let band = 0; band <= 9; band++) {
      const level =
        band === 0
          ? 'No assessable response.'
          : band <= 3
            ? 'Limited evidence; substantial barriers to communicating the intended meaning.'
            : band <= 5
              ? 'Some successful evidence, with frequent gaps requiring targeted practice.'
              : band <= 7
                ? 'Generally successful evidence with some inconsistent or imprecise execution.'
                : 'Consistently successful evidence with precise, flexible execution.';
      await tx.bandDescriptor.upsert({
        where: {
          criterionId_bandValue: { criterionId: row.id, bandValue: band },
        },
        update: {},
        create: {
          criterionId: row.id,
          bandValue: band,
          description: `Demo teaching example only, not an official IELTS band descriptor. ${criterion.name}: ${level}`,
        },
      });
    }
  }
  for (const [index, sample] of writingActivities.entries()) {
    const activityId = writingId(100 + index * 10);
    const item = await tx.learningItem.upsert({
      where: { id: activityId },
      update: {},
      create: {
        id: activityId,
        courseId: course.id,
        kind: 'PRACTICE',
        title: `[Demo] ${sample.title}`,
        status: 'PUBLISHED',
        position: index + 1,
      },
    });
    if (item.courseId !== course.id || item.kind !== 'PRACTICE')
      throw new Error('Writing demo activity ID is occupied');
    await tx.practiceActivity.upsert({
      where: { id: activityId },
      update: {},
      create: {
        id: activityId,
        creatorId: teacherId,
        skillArea: 'WRITING',
        responseMode: 'WRITING',
      },
    });
    const version = await tx.activityVersion.upsert({
      where: { activityId_versionNo: { activityId, versionNo: 1 } },
      update: {},
      create: {
        id: writingId(101 + index * 10),
        activityId,
        versionNo: 1,
        promptText: sample.prompt,
        instructions: sample.instructions,
        difficulty: sample.difficulty,
        expectedMinutes: 40,
        publishedAt: new Date(),
        contentHash: createHash('sha256')
          .update(
            JSON.stringify({
              prompt: sample.prompt,
              instructions: sample.instructions,
            }),
          )
          .digest('hex'),
      },
    });
    for (const skillIndex of sample.skills)
      await tx.learningItemSkill.upsert({
        where: {
          learningItemId_skillId: {
            learningItemId: activityId,
            skillId: skills[skillIndex].id,
          },
        },
        update: {},
        create: {
          learningItemId: activityId,
          skillId: skills[skillIndex].id,
          purpose: sample.purpose,
          coverageWeight: 1,
        },
      });
    const assignment = await tx.assignment.upsert({
      where: { id: writingId(102 + index * 10) },
      update: {},
      create: {
        id: writingId(102 + index * 10),
        courseId: course.id,
        activityId,
        creatorId: teacherId,
        title: `[Demo] ${sample.title}`,
      },
    });
    if (
      assignment.activityId !== activityId ||
      assignment.courseId !== course.id
    )
      throw new Error('Writing demo assignment ID is occupied');
    await tx.assignmentVersion.upsert({
      where: {
        assignmentId_versionNo: { assignmentId: assignment.id, versionNo: 1 },
      },
      update: {},
      create: {
        id: writingId(103 + index * 10),
        assignmentId: assignment.id,
        activityId,
        activityVersionId: version.id,
        rubricVersionId: rubric.id,
        mode: index === 5 ? 'GRADED' : 'PRACTICE',
        maxAttempts: 5,
        maxRevisions: 4,
        allowLate: false,
        releasePolicyJson: { releaseMode: 'IMMEDIATE' },
        publishedAt: new Date(),
      },
    });
  }
  const prompt = await tx.promptVersion.upsert({
    where: {
      promptCode_versionNo: { promptCode: 'DEMO_WRITING_CLINIC', versionNo: 1 },
    },
    update: {},
    create: {
      id: writingId(200),
      promptCode: 'DEMO_WRITING_CLINIC',
      versionNo: 1,
      instructions: WRITING_INSTRUCTIONS,
      outputSchemaJson: WRITING_SCHEMA,
    },
  });
  const provider = process.env.DEMO_GRADING_PROVIDER;
  const modelId = process.env.DEMO_GRADING_MODEL;
  if (provider && modelId) {
    if (!['JSON_HTTP', 'OPENAI'].includes(provider))
      throw new Error('Unsupported DEMO_GRADING_PROVIDER');
    const hash = createHash('sha256')
      .update(`${provider}:${modelId}`)
      .digest('hex');
    const configId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
    await tx.gradingConfig.upsert({
      where: { id: configId },
      update: {},
      create: {
        id: configId,
        rubricVersionId: rubric.id,
        promptVersionId: prompt.id,
        provider,
        modelId,
        settingsJson: {},
      },
    });
  }
  return {
    courseId: course.id,
    skills: skills.length,
    activities: writingActivities.length,
    providerConfigured: !!(provider && modelId),
  };
}

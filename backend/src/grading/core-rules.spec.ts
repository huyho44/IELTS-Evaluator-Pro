import { Prisma } from '@prisma/client';
import { validateAssessment } from './assessment-validation.js';
import { matchesAnswer } from './objective-scoring.js';
import { releaseTime } from './publication.service.js';
import { projectSkills } from '../recommendations/profile.js';
import {
  paragraphs,
  submissionPayload,
} from '../submissions/submission-validation.js';
import { AuthService } from '../auth/auth.service.js';
import { PrismaService } from '../prisma.service.js';

const criteria = ['TR', 'CC', 'LR', 'GRA'].map((code, i) => ({
  id: String(i),
  rubricVersionId: 'rubric',
  code,
  name: code,
  definition: code,
  weight: new Prisma.Decimal(0.25),
  maxScore: new Prisma.Decimal(9),
}));
const paragraph = {
  id: 'p1',
  revisionId: 'r1',
  paragraphNo: 1,
  text: 'Cities need better public transport.',
  startOffset: 0,
  endOffset: 35,
};
const valid = () => ({
  summary: 'Test assessment',
  criteria: criteria.map((c) => ({
    code: c.code,
    score: 6,
    explanation: 'Test rationale',
  })),
  findings: [
    {
      code: 'CC',
      kind: 'LOCAL',
      explanation: 'Test observation',
      anchors: [{ paragraphId: 'p1', exactQuote: 'public transport' }],
    },
  ],
});

describe('assessment quality gate', () => {
  it('computes the band and derives offsets from the immutable paragraph', () => {
    const result = validateAssessment(
      valid(),
      criteria,
      [paragraph],
      new Set(),
    );
    expect(result.overallScore).toBe(6);
    expect(result.findings[0].anchors[0]).toMatchObject({
      startOffset: 19,
      endOffset: 35,
    });
  });
  it('rejects quotes not found in the referenced revision', () => {
    const input = valid();
    input.findings[0].anchors[0].paragraphId = 'foreign';
    expect(() =>
      validateAssessment(input, criteria, [paragraph], new Set()),
    ).toThrow();
  });
  it('rejects invented quotes', () => {
    const input = valid();
    input.findings[0].anchors[0].exactQuote = 'made up';
    expect(() =>
      validateAssessment(input, criteria, [paragraph], new Set()),
    ).toThrow();
  });
  it.each([NaN, 10, -1, 6.2])('rejects invalid band %s', (score) => {
    const input = valid();
    input.criteria[0].score = score;
    expect(() =>
      validateAssessment(input, criteria, [paragraph], new Set()),
    ).toThrow();
  });
  it('rejects duplicate or missing criteria', () => {
    const input = valid();
    input.criteria[0].code = 'CC';
    expect(() =>
      validateAssessment(input, criteria, [paragraph], new Set()),
    ).toThrow();
  });
  it('does not trust a supplied overall band', () =>
    expect(() =>
      validateAssessment(
        { ...valid(), overallBand: 9 },
        criteria,
        [paragraph],
        new Set(),
      ),
    ).toThrow());
});
describe('answer-key rules', () => {
  it('normalizes text only according to the pinned rule', () => {
    expect(
      matchesAnswer(
        {
          method: 'TEXT_EXACT',
          trim: true,
          caseSensitive: false,
          collapseSpaces: true,
          maxWords: 2,
        },
        ['student card'],
        [],
        { textAnswer: ' Student   CARD ', optionIds: [] },
      ),
    ).toBe(true);
    expect(
      matchesAnswer(
        { method: 'TEXT_EXACT', maxWords: 2 },
        ['a student card'],
        [],
        { textAnswer: 'a student card', optionIds: [] },
      ),
    ).toBe(false);
  });
  it('requires the exact option set and gives zero for unanswered questions', () => {
    expect(
      matchesAnswer({ method: 'EXACT_OPTION_SET' }, null, ['a', 'b'], {
        textAnswer: null,
        optionIds: ['b', 'a'],
      }),
    ).toBe(true);
    expect(
      matchesAnswer({ method: 'EXACT_OPTION_SET' }, null, ['a'], {
        textAnswer: null,
        optionIds: [],
      }),
    ).toBe(false);
  });
  it('fails closed for an unsupported grading method', () =>
    expect(() =>
      matchesAnswer({ method: 'FUZZY' }, [], [], {
        textAnswer: '',
        optionIds: [],
      }),
    ).toThrow());
});
describe('publication and evidence', () => {
  it('keeps manual, missing and malformed release policies private', () => {
    expect(releaseTime({}, null)).toBeNull();
    expect(releaseTime({ releaseMode: 'MANUAL' }, null)).toBeNull();
    expect(
      releaseTime({ releaseMode: 'SCHEDULED', releaseAt: 'invalid' }, null),
    ).toBeNull();
  });
  it('uses the declared publication time', () => {
    const due = new Date('2030-01-01T00:00:00Z');
    expect(releaseTime({ releaseMode: 'AFTER_DUE_DATE' }, due)).toEqual(due);
  });
  it('counts only the latest revision for each attempt and skill, preserves zero, and leaves unknown null', () => {
    const result = projectSkills(
      [
        {
          id: 'a',
          attemptId: 'attempt1',
          skillId: 's1',
          revisionNo: 1,
          outcome: 'MET',
        },
        {
          id: 'b',
          attemptId: 'attempt1',
          skillId: 's1',
          revisionNo: 2,
          outcome: 'NOT_MET',
        },
        {
          id: 'c',
          attemptId: 'attempt2',
          skillId: 's2',
          revisionNo: 1,
          outcome: 'NOT_OBSERVED',
        },
      ],
      ['s1', 's2', 's3'],
    );
    expect(result.states[0]).toMatchObject({ evidenceCount: 1, strength: 0 });
    expect(result.states[1]).toMatchObject({
      evidenceCount: 0,
      strength: null,
      observationStatus: 'UNKNOWN',
    });
    expect(result.states[2].strength).toBeNull();
  });
});
describe('submission input', () => {
  it('preserves exact paragraph offsets across CRLF and blank lines', () => {
    const source = 'First line.\r\nMore text.\r\n\r\nSecond paragraph.';
    for (const p of paragraphs(source))
      expect(source.slice(p.startOffset, p.endOffset)).toBe(p.text);
    expect(paragraphs(source)).toHaveLength(2);
  });
  it('rejects mixed response modes and empty writing', () => {
    expect(() => submissionPayload({ writingText: ' ' }, 'WRITING')).toThrow();
    expect(() =>
      submissionPayload({ writingText: 'Essay', itemResponses: [] }, 'WRITING'),
    ).toThrow();
    expect(() =>
      submissionPayload(
        { itemResponses: [{ assessmentItemId: 1 }] },
        'OBJECTIVE',
      ),
    ).toThrow();
  });
});
describe('authentication boundary', () => {
  beforeEach(() =>
    vi.stubEnv('AUTH_TOKEN_SECRET', 'test-only-secret-with-at-least-32-bytes'),
  );
  afterEach(() => vi.unstubAllEnvs());
  it('rejects the legacy unsigned base64 token before touching the database', async () => {
    const service = new AuthService({} as PrismaService);
    await expect(
      service.getProfileFromToken(
        Buffer.from(JSON.stringify({ sub: 'fake', roles: ['ADMIN'] })).toString(
          'base64url',
        ),
      ),
    ).rejects.toThrow('Invalid or expired');
  });
  it('rejects malformed login input rather than making an unconstrained user query', async () => {
    const service = new AuthService({} as PrismaService);
    await expect(service.login({ password: 'password' })).rejects.toThrow();
    await expect(service.login({ email: 12, password: [] })).rejects.toThrow();
  });
});

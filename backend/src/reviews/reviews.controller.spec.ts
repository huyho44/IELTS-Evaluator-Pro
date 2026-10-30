import {
  Controller,
  UnauthorizedException,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Actor } from '../auth/auth.service.js';
import { AuthService } from '../auth/auth.service.js';
import { ReviewsController } from './reviews.controller.js';
import type { ReviewsService } from './reviews.service.js';

const reviewId = 'd5906fec-9a7c-4c35-8c01-55789d752b12';
const acceptedId = '0a4304f0-47da-4be8-a312-e1ba691f8073';
const actor: Actor = {
  id: 'teacher',
  email: 'teacher@test.example',
  displayName: 'Assigned teacher',
  roles: ['INSTRUCTOR'],
  status: 'ACTIVE',
  targetBand: null,
  targetExamDate: null,
};

async function fixture() {
  const accepted = {
    id: acceptedId,
    publishedAt: null,
    releaseAfter: null,
    isCurrent: false,
  };
  const service = {
    details: vi.fn().mockResolvedValue({
      id: reviewId,
      status: 'CLAIMED',
      lockVersion: 2,
      assigneeId: actor.id,
      revision: {
        writingText: 'Submitted essay.',
        attempt: {
          learner: { id: 'learner', displayName: 'Learner name' },
          assignmentVersion: {
            activityVersion: { promptText: 'Pinned prompt.' },
          },
        },
      },
      availableSkills: [],
    }),
    confirmReview: vi.fn().mockResolvedValue({
      decision: { id: 'decision' },
      assessment: { id: 'teacher-result' },
      acceptedAssessment: accepted,
    }),
    publish: vi.fn().mockResolvedValue({
      ...accepted,
      publishedAt: new Date('2026-10-30T08:00:00.000Z'),
      isCurrent: true,
    }),
  };
  const auth = {
    authenticate: vi.fn(async (header?: string) => {
      if (header !== 'Bearer test-token') throw new UnauthorizedException();
      return actor;
    }),
  };
  // Explicit dependency construction keeps this HTTP contract independent of
  // database startup and decorator-metadata support in the test transformer.
  @Controller()
  class ContractController extends ReviewsController {
    constructor() {
      super(
        service as unknown as ReviewsService,
        auth as unknown as AuthService,
      );
    }
  }
  const module = await Test.createTestingModule({
    controllers: [ContractController],
  }).compile();
  const app = module.createNestApplication();
  await app.init();
  return { app, service, auth };
}

describe('Reviews HTTP contract', () => {
  let context: Awaited<ReturnType<typeof fixture>>;
  let app: INestApplication;

  beforeEach(async () => {
    context = await fixture();
    app = context.app;
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects unauthenticated detail requests before calling the service', async () => {
    await request(app.getHttpServer()).get(`/reviews/${reviewId}`).expect(401);
    expect(context.service.details).not.toHaveBeenCalled();
  });

  it('returns the editor contract through the authenticated detail route', async () => {
    const response = await request(app.getHttpServer())
      .get(`/reviews/${reviewId}`)
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(context.service.details).toHaveBeenCalledWith(reviewId, actor);
    expect(response.body).toMatchObject({
      status: 'CLAIMED',
      lockVersion: 2,
      availableSkills: [],
      revision: {
        writingText: 'Submitted essay.',
        attempt: {
          learner: { displayName: 'Learner name' },
          assignmentVersion: {
            activityVersion: { promptText: 'Pinned prompt.' },
          },
        },
      },
    });
  });

  it('confirms a review without publishing a manually released accepted assessment', async () => {
    const body = {
      lockVersion: 2,
      reason: 'Verified the evidence and rubric.',
      summary: 'Develop the supporting examples.',
      criteria: ['TR', 'CC', 'LR', 'GRA'].map((code) => ({
        code,
        score: 6.5,
        explanation: 'Criterion-specific rationale.',
      })),
      findings: [],
      observations: [],
    };
    const response = await request(app.getHttpServer())
      .post(`/reviews/${reviewId}/confirm`)
      .set('Authorization', 'Bearer test-token')
      .send(body)
      .expect(201);

    expect(context.service.confirmReview).toHaveBeenCalledWith(
      reviewId,
      body,
      actor,
    );
    expect(response.body.acceptedAssessment).toMatchObject({
      id: acceptedId,
      publishedAt: null,
      isCurrent: false,
    });
    expect(context.service.publish).not.toHaveBeenCalled();
  });

  it('publishes using the accepted assessment ID and does not expose the obsolete review publish route', async () => {
    const response = await request(app.getHttpServer())
      .post(`/assessments/${acceptedId}/publish`)
      .set('Authorization', 'Bearer test-token')
      .expect(201);
    expect(context.service.publish).toHaveBeenCalledWith(acceptedId, actor);
    expect(response.body.publishedAt).toBe('2026-10-30T08:00:00.000Z');

    await request(app.getHttpServer())
      .post(`/reviews/${reviewId}/publish`)
      .set('Authorization', 'Bearer test-token')
      .expect(404);
    expect(context.service.publish).toHaveBeenCalledTimes(1);
  });
});

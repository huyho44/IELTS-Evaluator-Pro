import { describe, expect, it } from 'vitest';
import {
  compareRecommendationBaselines,
  fixedPathBaseline,
  lowestCriterionBaseline,
  type BaselineContext,
} from './recommendation-baselines.js';

const context: BaselineContext = {
  learnerId: 'synthetic-learner',
  criterionScores: { TR: 6, CC: 5, LR: 6, GRA: 6 },
  candidates: [
    { id: 'advanced', position: 0, criteria: ['CC'], eligible: false },
    { id: 'development', position: 1, criteria: ['TR'], eligible: true },
    { id: 'progression', position: 2, criteria: ['CC'], eligible: true },
    { id: 'reference', position: 3, criteria: ['CC'], eligible: true },
    { id: 'grammar', position: 4, criteria: ['GRA'], eligible: true },
  ],
  proposedIds: ['reference', 'grammar'],
};
describe('explicit recommendation baselines', () => {
  it('uses a shared eligibility snapshot for both baselines with deterministic explanations', () => {
    expect(fixedPathBaseline(context.candidates).map((c) => c.id)).toEqual([
      'development',
      'progression',
      'reference',
    ]);
    expect(lowestCriterionBaseline(context).map((c) => c.id)).toEqual([
      'progression',
      'reference',
    ]);
    expect(lowestCriterionBaseline(context)[0].reason).toContain('CC (5)');
  });
  it('does not invent relevance labels or learning effects and flags invalid proposed targets', () => {
    const report = compareRecommendationBaselines({
      ...context,
      proposedIds: ['advanced', 'missing'],
    });
    expect(report.proposed.ineligibleOrUnknownIds).toEqual([
      'advanced',
      'missing',
    ]);
    expect(report.fixedPath.precisionAtReturnedCount).toBeNull();
    expect(report.relevanceLabelsProvided).toBe(false);
  });
  it('calculates relevance only from supplied external labels and keeps criterion baseline independent of proposed policy', () => {
    const first = compareRecommendationBaselines({
      ...context,
      expertRelevantIds: ['reference'],
    });
    const second = compareRecommendationBaselines({
      ...context,
      proposedIds: ['progression'],
    });
    expect(first.proposed.precisionAtReturnedCount).toBe(0.5);
    expect(first.lowestCriterion.ids).toEqual(second.lowestCriterion.ids);
    expect(first.proposed.ids).not.toEqual(second.proposed.ids);
  });
  it('rejects duplicate candidates and resolves equal criterion scores in declared order', () => {
    expect(() =>
      compareRecommendationBaselines({
        ...context,
        expertRelevantIds: 'reference' as unknown as string[],
      }),
    ).toThrow('relevance labels');
    expect(() =>
      compareRecommendationBaselines({
        ...context,
        candidates: [...context.candidates, context.candidates[0]],
      }),
    ).toThrow('Duplicate');
    expect(
      lowestCriterionBaseline({
        ...context,
        criterionScores: { TR: 5, CC: 5, LR: 6, GRA: 6 },
      }).map((c) => c.id),
    ).toEqual(['development']);
  });
});

import { CRITERIA, type Scores } from './writing-evaluation.js';

export type BaselineCandidate = {
  id: string;
  position: number;
  criteria: (keyof Scores)[];
  eligible: boolean;
};
export type BaselineContext = {
  learnerId: string;
  criterionScores: Scores;
  candidates: BaselineCandidate[];
  proposedIds: string[];
  // Optional external expert relevance labels; never synthesized by the runner.
  expertRelevantIds?: string[];
};
export function fixedPathBaseline(candidates: BaselineCandidate[], limit = 3) {
  return candidates
    .filter((c) => c.eligible)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map((c) => ({
      id: c.id,
      reason: 'First eligible activity in the fixed curriculum order.',
    }));
}
export function lowestCriterionBaseline(context: BaselineContext, limit = 3) {
  const lowest = [...CRITERIA].sort(
    (a, b) =>
      context.criterionScores[a] - context.criterionScores[b] ||
      CRITERIA.indexOf(a) - CRITERIA.indexOf(b),
  )[0];
  const matching = context.candidates.filter(
    (c) => c.eligible && c.criteria.includes(lowest),
  );
  return fixedPathBaseline(matching, limit).map((c) => ({
    id: c.id,
    reason: `Targets the lowest criterion ${lowest} (${context.criterionScores[lowest]}); ties use TR, CC, LR, GRA order.`,
  }));
}
export function compareRecommendationBaselines(context: BaselineContext) {
  if (
    typeof context.learnerId !== 'string' ||
    !context.learnerId.trim() ||
    !context.criterionScores ||
    typeof context.criterionScores !== 'object' ||
    !Array.isArray(context.candidates) ||
    !Array.isArray(context.proposedIds) ||
    context.proposedIds.some((id) => typeof id !== 'string' || !id.trim()) ||
    (context.expertRelevantIds !== undefined &&
      (!Array.isArray(context.expertRelevantIds) ||
        context.expertRelevantIds.some(
          (id) => typeof id !== 'string' || !id.trim(),
        )))
  )
    throw new Error('Invalid baseline learner, targets or relevance labels');
  if (
    context.candidates.some(
      (c) =>
        !c ||
        typeof c !== 'object' ||
        typeof c.id !== 'string' ||
        !Array.isArray(c.criteria),
    )
  )
    throw new Error('Invalid baseline candidate metadata');
  const candidates = new Map(context.candidates.map((c) => [c.id, c]));
  if (candidates.size !== context.candidates.length)
    throw new Error('Duplicate baseline candidate id');
  if (
    !CRITERIA.every(
      (code) =>
        Number.isFinite(context.criterionScores[code]) &&
        context.criterionScores[code] >= 0 &&
        context.criterionScores[code] <= 9,
    )
  )
    throw new Error('Provide four valid criterion scores');
  if (
    context.candidates.some(
      (c) =>
        !c.id ||
        !Number.isFinite(c.position) ||
        typeof c.eligible !== 'boolean' ||
        c.criteria.some((code) => !CRITERIA.includes(code)),
    )
  )
    throw new Error('Invalid baseline candidate metadata');
  if (
    new Set(context.proposedIds).size !== context.proposedIds.length ||
    context.proposedIds.length > 3
  )
    throw new Error(
      'Proposed recommendations must have up to three unique ids',
    );
  const relevance = context.expertRelevantIds
    ? new Set(context.expertRelevantIds)
    : null;
  const describe = (ids: string[]) => ({
    ids,
    ineligibleOrUnknownIds: ids.filter((id) => !candidates.get(id)?.eligible),
    precisionAtReturnedCount:
      relevance && ids.length
        ? ids.filter((id) => relevance.has(id)).length / ids.length
        : null,
    overlapWithProposed: ids.filter((id) => context.proposedIds.includes(id))
      .length,
  });
  const fixed = fixedPathBaseline(context.candidates),
    lowest = lowestCriterionBaseline(context);
  return {
    learnerId: context.learnerId,
    proposed: describe(context.proposedIds),
    fixedPath: { ...describe(fixed.map((c) => c.id)), explanations: fixed },
    lowestCriterion: {
      ...describe(lowest.map((c) => c.id)),
      explanations: lowest,
    },
    relevanceLabelsProvided: !!relevance,
    limitations:
      'Candidate eligibility must come from the same published content/access/prerequisite snapshot for all policies. Overlap is descriptive, not learning effectiveness. Relevance precision is available only when external relevance labels are supplied.',
  };
}

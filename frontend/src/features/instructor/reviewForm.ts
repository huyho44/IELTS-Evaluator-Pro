import type {
  AcceptedAssessment,
  ConfirmReviewPayload,
  CriterionInput,
  DecimalJson,
  FindingInput,
  ObservationOutcome,
  ReviewAssessment,
  ReviewDetail,
  ReviewFormState,
} from './types';

export function decimalNumber(value: DecimalJson, label = 'Score'): number {
  if ((typeof value !== 'string' && typeof value !== 'number') ||
      (typeof value === 'string' && !value.trim())) {
    throw new Error(`${label} is invalid.`);
  }
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error(`${label} is invalid.`);
  return result;
}

export function teacherAssessment(detail: ReviewDetail): ReviewAssessment | undefined {
  const decision = [...detail.reviewDecisions]
    .filter((item) => item.reviewCaseId === detail.id)
    .sort((a, b) => b.decisionNo - a.decisionNo)[0];
  return decision ? detail.revision.assessmentResults.find((item) =>
    item.kind === 'TEACHER' && item.revisionId === detail.revisionId &&
    item.teacherResult?.decisionId === decision.id,
  ) : undefined;
}

export function aiAssessment(detail: ReviewDetail): ReviewAssessment | undefined {
  const rubricId = detail.revision.attempt.assignmentVersion.rubricVersion?.id;
  if (!detail.targetRunId || !rubricId) return undefined;
  return detail.revision.assessmentResults.find((item) =>
    item.kind === 'AI' && item.revisionId === detail.revisionId &&
    item.rubricVersionId === rubricId && item.aiResult?.gradingRunId === detail.targetRunId,
  );
}

export function acceptedAssessmentForReview(detail: ReviewDetail): AcceptedAssessment | null {
  return teacherAssessment(detail)?.acceptedAssessment ?? null;
}

export function canConfirmReview(detail: ReviewDetail, userId: string | undefined): boolean {
  const rubric = detail.revision.attempt.assignmentVersion.rubricVersion;
  const hasSubmission = detail.revision.responseMode !== 'WRITING' || !!detail.revision.writingText?.trim();
  return detail.revision.responseMode !== 'OBJECTIVE' &&
    hasSubmission &&
    detail.status === 'CLAIMED' && detail.assigneeId === userId &&
    !!rubric?.publishedAt && rubric.rubricCriterions.length > 0;
}

export function createReviewForm(detail: ReviewDetail): ReviewFormState {
  const rubric = detail.revision.attempt.assignmentVersion.rubricVersion;
  const saved = teacherAssessment(detail);
  const reference = saved ?? aiAssessment(detail);
  const decision = saved?.teacherResult
    ? detail.reviewDecisions.find((item) => item.id === saved.teacherResult?.decisionId)
    : undefined;
  const findings: FindingInput[] = (reference?.findings ?? []).map((finding) => ({
    id: finding.id,
    approved: !!saved,
    code: reference?.criterionScores.find((score) => score.id === finding.criterionScoreId)?.criterion.code ?? '',
    kind: finding.findingKind === 'LOCAL' || finding.findingKind === 'GLOBAL' ? finding.findingKind : '',
    explanation: finding.explanation,
    skillId: finding.skillId ?? '',
    anchors: finding.findingAnchors.map((anchor) => ({ paragraphId: anchor.paragraphId, exactQuote: anchor.exactQuote })),
  }));
  return {
    reason: decision?.reason ?? '',
    summary: saved?.summary ?? '',
    criteria: (rubric?.rubricCriterions ?? []).map((criterion) => {
      const score = saved?.criterionScores.find((item) => item.criterionId === criterion.id);
      return {
        code: criterion.code,
        name: criterion.name,
        maxScore: decimalNumber(criterion.maxScore, `${criterion.code} maximum`),
        score: score ? String(decimalNumber(score.score)) : '',
        explanation: score?.explanation ?? '',
      };
    }),
    findings,
    // A suggested finding or a low band does not automatically become skill evidence.
    observations: detail.availableSkills.map((skill) => {
      const observation = saved?.skillObservations.find((item) => item.skillId === skill.id);
      return {
        id: observation?.id ?? `skill-${skill.id}`,
        approved: !!observation,
        skillId: skill.id,
        outcome: observation?.outcome ?? 'NOT_OBSERVED',
        rationale: observation?.rationale ?? '',
      };
    }),
  };
}

function requiredText(value: string, label: string, max = 10000): string {
  if (!value.trim() || value.length > max) {
    throw new Error(`${label} must contain text of at most ${max} characters.`);
  }
  return value.trim();
}

function criterionPayload(detail: ReviewDetail, inputs: CriterionInput[]) {
  const rubric = detail.revision.attempt.assignmentVersion.rubricVersion;
  if (!rubric?.publishedAt || !rubric.rubricCriterions.length) {
    throw new Error('A published rubric must be pinned to this assignment.');
  }
  if (inputs.length !== rubric.rubricCriterions.length) {
    throw new Error('Enter exactly one score for every rubric criterion.');
  }
  return rubric.rubricCriterions.map((criterion) => {
    const matches = inputs.filter((input) => input.code === criterion.code);
    if (matches.length !== 1) throw new Error(`Enter exactly one score for ${criterion.code}.`);
    const row = matches[0];
    const score = decimalNumber(row.score, `${criterion.code} score`);
    if (score < 0 || score > 9 || !Number.isInteger(score * 2) ||
        score > decimalNumber(criterion.maxScore)) {
      throw new Error(`${criterion.code} must be within the rubric range, in steps of 0.5.`);
    }
    return { code: criterion.code, score, explanation: requiredText(row.explanation, `${criterion.code} explanation`) };
  });
}

export function weightedOverall(detail: ReviewDetail, inputs: CriterionInput[]): number | null {
  const rubric = detail.revision.attempt.assignmentVersion.rubricVersion;
  if (!rubric?.rubricCriterions.length || inputs.length !== rubric.rubricCriterions.length) return null;
  try {
    let total = 0;
    let weight = 0;
    for (const criterion of rubric.rubricCriterions) {
      const rows = inputs.filter((input) => input.code === criterion.code);
      if (rows.length !== 1) return null;
      const score = decimalNumber(rows[0].score);
      const currentWeight = decimalNumber(criterion.weight, 'Rubric weight');
      if (score < 0 || score > 9 || score > decimalNumber(criterion.maxScore) ||
          !Number.isInteger(score * 2) || currentWeight < 0) return null;
      total += score * currentWeight;
      weight += currentWeight;
    }
    return weight > 0 ? Math.round(total / weight * 2) / 2 : null;
  } catch {
    return null;
  }
}

export function buildConfirmPayload(
  detail: ReviewDetail,
  form: ReviewFormState,
  userId: string,
): ConfirmReviewPayload {
  if (detail.revision.responseMode === 'WRITING' && !detail.revision.writingText?.trim()) {
    throw new Error('The Writing submission text is missing. Reload the review before assessing it.');
  }
  if (!canConfirmReview(detail, userId)) throw new Error('Claim this review before confirming.');
  const criteria = criterionPayload(detail, form.criteria);
  const skillIds = new Set(detail.availableSkills.map((skill) => skill.id));
  const approvedFindings = form.findings.filter((finding) => finding.approved);
  const approvedObservations = form.observations.filter((observation) => observation.approved);
  if (approvedFindings.length > 100 || approvedObservations.length > 100) {
    throw new Error('Confirm at most 100 findings and 100 skill observations.');
  }
  const findings = approvedFindings.map((finding) => {
    if (!criteria.some((criterion) => criterion.code === finding.code)) throw new Error('Choose a rubric criterion for each accepted finding.');
    if (finding.kind !== 'LOCAL' && finding.kind !== 'GLOBAL') throw new Error('Choose a finding type.');
    if (finding.skillId && !skillIds.has(finding.skillId)) throw new Error('Choose an available skill for each accepted finding.');
    if (finding.anchors.length > 20 || (finding.kind === 'LOCAL' && !finding.anchors.length)) {
      throw new Error('Local findings need evidence, with at most 20 anchors per finding.');
    }
    const anchors = finding.anchors.map((anchor) => {
      const paragraph = detail.revision.revisionParagraphs.find((item) => item.id === anchor.paragraphId);
      const exactQuote = requiredText(anchor.exactQuote, 'Evidence quote');
      if (!paragraph || !paragraph.text.includes(exactQuote)) throw new Error('Evidence must quote the selected paragraph exactly.');
      return { paragraphId: paragraph.id, exactQuote };
    });
    return {
      code: finding.code,
      ...(finding.skillId ? { skillId: finding.skillId } : {}),
      kind: finding.kind,
      explanation: requiredText(finding.explanation, 'Finding explanation'),
      anchors,
    };
  });
  const outcomes: ObservationOutcome[] = ['MET', 'PARTIAL', 'NOT_MET', 'NOT_OBSERVED'];
  const seenSkills = new Set<string>();
  const observations = approvedObservations.map((observation) => {
    if (!skillIds.has(observation.skillId) || seenSkills.has(observation.skillId)) throw new Error('Choose each available skill at most once.');
    if (!outcomes.includes(observation.outcome)) throw new Error('Choose a valid skill outcome.');
    seenSkills.add(observation.skillId);
    return {
      skillId: observation.skillId,
      outcome: observation.outcome,
      rationale: requiredText(observation.rationale, 'Skill observation rationale'),
    };
  });
  return {
    lockVersion: detail.lockVersion,
    reason: requiredText(form.reason, 'Decision reason'),
    summary: requiredText(form.summary, 'Overall feedback'),
    criteria,
    findings,
    observations,
  };
}

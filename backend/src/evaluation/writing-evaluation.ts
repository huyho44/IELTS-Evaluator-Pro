import { createHash } from 'node:crypto';
import {
  Prisma,
  type RevisionParagraph,
  type RubricCriterion,
} from '@prisma/client';
import { validateAssessment } from '../grading/assessment-validation.js';
import { paragraphs } from '../submissions/submission-validation.js';
import type {
  GradingInput,
  ProviderEvaluation,
} from '../grading/grading-provider.js';
import {
  DEMO_CRITERIA,
  WRITING_INSTRUCTIONS,
  WRITING_SCHEMA,
} from './writing-contract.js';

export const CRITERIA = ['TR', 'CC', 'LR', 'GRA'] as const;
export type CriterionCode = (typeof CRITERIA)[number];
export type Scores = Record<CriterionCode, number>;
export type EvaluationRow = {
  id: string;
  split: 'dev' | 'holdout';
  opportunityGroup: string;
  labelSource: 'expert' | 'synthetic';
  raterId?: string;
  task: string;
  text: string;
  labels: { overall: number; criteria: Scores };
};
export type EvaluationRubric = {
  code: string;
  versionNo: number;
  isDemo: boolean;
  criteria: {
    code: CriterionCode;
    name: string;
    definition: string;
    weight: number;
    maxScore: number;
    bandDescriptors?: unknown[];
  }[];
};
export const DEMO_EVALUATION_RUBRIC: EvaluationRubric = {
  code: 'DEMO_WRITING_CLINIC_TASK2',
  versionNo: 1,
  isDemo: true,
  criteria: DEMO_CRITERIA.map((c) => ({ ...c, weight: 0.25, maxScore: 9 })),
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected a JSON object');
  return value as Record<string, unknown>;
}
function nonempty(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`${name} must be a nonempty string`);
  return value;
}
function score(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 9 ||
    value * 2 !== Math.round(value * 2)
  )
    throw new Error('Labels must use half bands from 0 to 9');
  return value;
}
export function validateDataset(input: unknown[]): EvaluationRow[] {
  if (!input.length) throw new Error('Dataset is empty');
  const ids = new Set<string>();
  const groups = new Map<string, string>();
  return input.map((value) => {
    const row = record(value);
    const id = nonempty(row.id, 'id');
    if (ids.has(id)) throw new Error(`Duplicate dataset id: ${id}`);
    ids.add(id);
    if (row.split !== 'dev' && row.split !== 'holdout')
      throw new Error(`Invalid split for ${id}`);
    if (row.labelSource !== 'expert' && row.labelSource !== 'synthetic')
      throw new Error(`Declare labelSource for ${id}`);
    const opportunityGroup = nonempty(row.opportunityGroup, 'opportunityGroup');
    const split = groups.get(opportunityGroup);
    if (split && split !== row.split)
      throw new Error(
        `Leakage: opportunityGroup ${opportunityGroup} occurs in dev and holdout`,
      );
    groups.set(opportunityGroup, row.split);
    const text = nonempty(row.text, 'text');
    if (text.length > 100000)
      throw new Error(`Essay exceeds submission limit: ${id}`);
    const labels = record(row.labels),
      values = record(labels.criteria);
    if (Object.keys(values).sort().join(',') !== [...CRITERIA].sort().join(','))
      throw new Error(`Expected exactly TR/CC/LR/GRA expert labels: ${id}`);
    return {
      id,
      split: row.split,
      opportunityGroup,
      labelSource: row.labelSource,
      ...(row.labelSource === 'expert'
        ? { raterId: nonempty(row.raterId, 'raterId for expert labels') }
        : {}),
      task: nonempty(row.task, 'task'),
      text,
      labels: {
        overall: score(labels.overall),
        criteria: Object.fromEntries(
          CRITERIA.map((code) => [code, score(values[code])]),
        ) as Scores,
      },
    };
  });
}
export function validateRubric(value: unknown): EvaluationRubric {
  const input = record(value);
  if (
    !Number.isInteger(input.versionNo) ||
    Number(input.versionNo) < 1 ||
    typeof input.isDemo !== 'boolean' ||
    !Array.isArray(input.criteria)
  )
    throw new Error('Rubric requires versionNo, isDemo and criteria');
  const criteria = input.criteria.map((value) => {
    const c = record(value);
    if (
      !CRITERIA.includes(c.code as CriterionCode) ||
      typeof c.weight !== 'number' ||
      c.weight <= 0 ||
      !Number.isFinite(c.weight) ||
      c.maxScore !== 9
    )
      throw new Error('Invalid rubric criterion');
    return {
      code: c.code as CriterionCode,
      name: nonempty(c.name, 'name'),
      definition: nonempty(c.definition, 'definition'),
      weight: c.weight,
      maxScore: 9,
      ...(Array.isArray(c.bandDescriptors)
        ? { bandDescriptors: c.bandDescriptors }
        : {}),
    };
  });
  if (new Set(criteria.map((c) => c.code)).size !== 4 || criteria.length !== 4)
    throw new Error('Rubric requires one of each TR/CC/LR/GRA criterion');
  return {
    code: nonempty(input.code, 'rubric code'),
    versionNo: Number(input.versionNo),
    isDemo: input.isDemo,
    criteria,
  };
}
function stableId(value: string): string {
  const h = createHash('sha256').update(value).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export function evaluationInput(
  row: EvaluationRow,
  rubric: EvaluationRubric,
  provider: string,
  model: string,
): {
  input: GradingInput;
  paragraphs: RevisionParagraph[];
  criteria: RubricCriterion[];
} {
  const revisionId = stableId(row.id);
  const fixedParagraphs = paragraphs(row.text).map((p) => ({
    ...p,
    revisionId,
    id: stableId(`${row.id}:paragraph:${p.paragraphNo}`),
  }));
  const fixedCriteria = rubric.criteria.map((c) => ({
    ...c,
    id: stableId(`${rubric.code}:${rubric.versionNo}:${c.code}`),
    rubricVersionId: stableId(`${rubric.code}:${rubric.versionNo}`),
    weight: new Prisma.Decimal(c.weight),
    maxScore: new Prisma.Decimal(c.maxScore),
  }));
  return {
    paragraphs: fixedParagraphs,
    criteria: fixedCriteria,
    input: {
      provider,
      model,
      instructions: WRITING_INSTRUCTIONS,
      schema: WRITING_SCHEMA,
      settings: {},
      // Deliberately construct the provider payload: no labels, rater IDs or split metadata.
      context: {
        task: row.task,
        taskInstructions:
          'IELTS Writing Task 2: assess the submitted response.',
        rubric,
        paragraphs: fixedParagraphs,
        skills: [],
        untrustedSubmission: row.text,
      },
    },
  };
}
export type EvaluationPrediction = Partial<
  Omit<ProviderEvaluation, 'assessment' | 'rawResponse'>
> & {
  assessment: unknown;
  latencyMs?: number;
  errorCode?: string;
};
type EvaluationResult = {
  id: string;
  valid: boolean;
  errorCode?: string;
  anchorsTotal: number;
  anchorsValid: number;
  predicted?: { overall: number; criteria: Scores };
  absoluteErrors?: { overall: number; criteria: Scores };
  latencyMs: number | null;
  providerRequestId?: string;
  inputTokens: number | null;
  outputTokens: number | null;
};
function nonnegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}
function tokens(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}
export function assessPrediction(
  row: EvaluationRow,
  prediction: EvaluationPrediction,
  rubric: EvaluationRubric,
): EvaluationResult {
  const fixed = evaluationInput(row, rubric, 'OFFLINE', 'offline');
  let anchorsTotal = 0,
    anchorsValid = 0;
  const raw = prediction.assessment;
  if (
    raw &&
    typeof raw === 'object' &&
    'findings' in raw &&
    Array.isArray(raw.findings)
  ) {
    for (const finding of raw.findings) {
      if (
        !finding ||
        typeof finding !== 'object' ||
        !('anchors' in finding) ||
        !Array.isArray(finding.anchors)
      )
        continue;
      for (const anchor of finding.anchors) {
        anchorsTotal++;
        if (!anchor || typeof anchor !== 'object') continue;
        const a = anchor as Record<string, unknown>;
        const quote =
          typeof a.exactQuote === 'string' ? a.exactQuote.trim() : '';
        if (
          quote &&
          fixed.paragraphs.some(
            (p) => p.id === a.paragraphId && p.text.includes(quote),
          )
        )
          anchorsValid++;
      }
    }
  }
  const base: EvaluationResult = {
    id: row.id,
    valid: false,
    anchorsTotal,
    anchorsValid,
    latencyMs: nonnegative(prediction.latencyMs),
    providerRequestId: prediction.providerRequestId,
    inputTokens: tokens(prediction.inputTokens),
    outputTokens: tokens(prediction.outputTokens),
  };
  if (prediction.errorCode) return { ...base, errorCode: prediction.errorCode };
  try {
    const validated = validateAssessment(
      raw,
      fixed.criteria,
      fixed.paragraphs,
      new Set(),
    );
    const predictedCriteria = Object.fromEntries(
      validated.scores.map((c) => [c.code, c.score]),
    ) as Scores;
    return {
      ...base,
      valid: true,
      predicted: {
        overall: validated.overallScore,
        criteria: predictedCriteria,
      },
      absoluteErrors: {
        overall: Math.abs(validated.overallScore - row.labels.overall),
        criteria: Object.fromEntries(
          CRITERIA.map((code) => [
            code,
            Math.abs(predictedCriteria[code] - row.labels.criteria[code]),
          ]),
        ) as Scores,
      },
    };
  } catch {
    return { ...base, errorCode: 'INVALID_ASSESSMENT' };
  }
}
export function summarizeEvaluation(
  rows: EvaluationRow[],
  results: EvaluationResult[],
  rubric: EvaluationRubric,
) {
  const valid = results.filter((r) => r.valid);
  const mean = (values: number[]) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const latencies = results
    .flatMap((r) => (r.latencyMs === null ? [] : [r.latencyMs]))
    .sort((a, b) => a - b);
  const anchorsTotal = results.reduce((n, r) => n + r.anchorsTotal, 0),
    anchorsValid = results.reduce((n, r) => n + r.anchorsValid, 0);
  const synthetic = rows.some((r) => r.labelSource === 'synthetic');
  return {
    evaluationType: synthetic
      ? 'SYNTHETIC_SMOKE_TEST_NOT_ACCURACY_EVIDENCE'
      : 'EXTERNAL_EXPERT_LABEL_EVALUATION',
    rubric: {
      code: rubric.code,
      versionNo: rubric.versionNo,
      isDemo: rubric.isDemo,
    },
    attempted: results.length,
    valid: valid.length,
    invalidOrFailed: results.length - valid.length,
    errorCounts: results.reduce<Record<string, number>>((counts, result) => {
      if (result.errorCode)
        counts[result.errorCode] = (counts[result.errorCode] ?? 0) + 1;
      return counts;
    }, {}),
    validCoverage: results.length ? valid.length / results.length : null,
    maeOverall: mean(valid.map((r) => r.absoluteErrors!.overall)),
    maeByCriterion: Object.fromEntries(
      CRITERIA.map((code) => [
        code,
        mean(valid.map((r) => r.absoluteErrors!.criteria[code])),
      ]),
    ),
    largeOverallErrorsAboveOneBand: valid.filter(
      (r) => r.absoluteErrors!.overall > 1,
    ).length,
    evidenceAnchors: {
      total: anchorsTotal,
      valid: anchorsValid,
      invalid: anchorsTotal - anchorsValid,
      validityRate: anchorsTotal ? anchorsValid / anchorsTotal : null,
    },
    latencyMs: {
      observed: latencies.length,
      mean: mean(latencies),
      p95: latencies.length
        ? latencies[Math.ceil(latencies.length * 0.95) - 1]
        : null,
    },
    usage: {
      inputTokens: results.reduce((n, r) => n + (r.inputTokens ?? 0), 0),
      outputTokens: results.reduce((n, r) => n + (r.outputTokens ?? 0), 0),
      rowsWithUnknownUsage: results.filter(
        (r) => r.inputTokens === null || r.outputTokens === null,
      ).length,
    },
    limitations: [
      'MAE excludes failed/invalid outputs; read validCoverage alongside it.',
      'Quote validity checks existence, not pedagogical correctness.',
      'No learning improvement, teacher effort or calibrated mastery claim follows from these metrics.',
      ...(synthetic
        ? [
            'Synthetic labels are illustrative test values, not expert judgments.',
          ]
        : []),
      ...(rubric.isDemo
        ? ['Demo rubric is not an official or validated IELTS scoring rubric.']
        : []),
    ],
    results,
  };
}

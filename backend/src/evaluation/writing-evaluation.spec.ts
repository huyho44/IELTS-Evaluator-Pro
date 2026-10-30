import { describe, expect, it } from 'vitest';
import {
  DEMO_EVALUATION_RUBRIC,
  assessPrediction,
  evaluationInput,
  summarizeEvaluation,
  validateDataset,
  validateRubric,
  type EvaluationRow,
} from './writing-evaluation.js';

const row: EvaluationRow = {
  id: 'synthetic-1',
  split: 'dev',
  opportunityGroup: 'synthetic-opportunity-1',
  labelSource: 'synthetic',
  task: 'Discuss transport.',
  text: 'Cities need reliable public transport.\n\nFunding is necessary.',
  labels: { overall: 5.5, criteria: { TR: 5, CC: 5, LR: 6, GRA: 6 } },
};
function prediction() {
  return {
    summary: 'Synthetic smoke feedback only.',
    criteria: ['TR', 'CC', 'LR', 'GRA'].map((code) => ({
      code,
      score: 6,
      explanation: 'Synthetic test rationale.',
    })),
    findings: [] as unknown[],
  };
}
describe('writing evaluation protocol', () => {
  it('rejects revision/opportunity leakage, duplicate ids and missing expert attribution', () => {
    expect(() =>
      validateDataset([row, { ...row, id: 'other', split: 'holdout' }]),
    ).toThrow('Leakage');
    expect(() => validateDataset([row, row])).toThrow('Duplicate');
    expect(() => validateDataset([{ ...row, labelSource: 'expert' }])).toThrow(
      'raterId',
    );
    expect(() =>
      validateDataset([{ ...row, labels: { ...row.labels, overall: 5.2 } }]),
    ).toThrow('half bands');
  });
  it('keeps expert labels out of provider payloads and produces stable paragraph ids for offline replay', () => {
    const expert = {
      ...row,
      labelSource: 'expert' as const,
      raterId: 'private-rater-123',
    };
    const first = evaluationInput(
      expert,
      DEMO_EVALUATION_RUBRIC,
      'OPENAI',
      'configured-model',
    );
    const second = evaluationInput(
      expert,
      DEMO_EVALUATION_RUBRIC,
      'OPENAI',
      'configured-model',
    );
    expect(first.paragraphs).toEqual(second.paragraphs);
    expect(first.input.context).not.toHaveProperty('labels');
    expect(first.input.context).not.toHaveProperty('split');
    expect(JSON.stringify(first.input)).not.toContain('private-rater-123');
    expect(first.paragraphs).toHaveLength(2);
  });
  it('computes per criterion and overall errors from validated backend scores', () => {
    const result = assessPrediction(
      row,
      {
        assessment: prediction(),
        latencyMs: 125,
        inputTokens: 200,
        outputTokens: 60,
      },
      DEMO_EVALUATION_RUBRIC,
    );
    const report = summarizeEvaluation([row], [result], DEMO_EVALUATION_RUBRIC);
    expect(report.evaluationType).toBe(
      'SYNTHETIC_SMOKE_TEST_NOT_ACCURACY_EVIDENCE',
    );
    expect(report.maeOverall).toBe(0.5);
    expect(report.maeByCriterion).toEqual({ TR: 1, CC: 1, LR: 0, GRA: 0 });
    expect(report.usage).toEqual({
      inputTokens: 200,
      outputTokens: 60,
      rowsWithUnknownUsage: 0,
    });
    expect(report.latencyMs.p95).toBe(125);
    expect(report.evidenceAnchors.validityRate).toBeNull();
  });
  it('reports fabricated evidence and failed outputs in coverage instead of silently improving MAE', () => {
    const [paragraph] = evaluationInput(
      row,
      DEMO_EVALUATION_RUBRIC,
      'OFFLINE',
      'offline',
    ).paragraphs;
    const bad = prediction();
    bad.findings.push({
      code: 'CC',
      kind: 'LOCAL',
      skillId: null,
      explanation: 'Synthetic test finding.',
      anchors: [
        { paragraphId: paragraph.id, exactQuote: 'reliable public transport' },
        { paragraphId: paragraph.id, exactQuote: 'fabricated quotation' },
      ],
    });
    const results = [
      assessPrediction(
        row,
        { assessment: prediction() },
        DEMO_EVALUATION_RUBRIC,
      ),
      assessPrediction(row, { assessment: bad }, DEMO_EVALUATION_RUBRIC),
      assessPrediction(
        row,
        { assessment: null, errorCode: 'REFUSED' },
        DEMO_EVALUATION_RUBRIC,
      ),
    ];
    const report = summarizeEvaluation([row], results, DEMO_EVALUATION_RUBRIC);
    expect(report.validCoverage).toBeCloseTo(1 / 3);
    expect(report.invalidOrFailed).toBe(2);
    expect(report.errorCounts).toEqual({ INVALID_ASSESSMENT: 1, REFUSED: 1 });
    expect(report.evidenceAnchors).toEqual({
      total: 2,
      valid: 1,
      invalid: 1,
      validityRate: 0.5,
    });
    expect(report.results[1].errorCode).toBe('INVALID_ASSESSMENT');
    expect(report.results[2].errorCode).toBe('REFUSED');
    expect(report.latencyMs.mean).toBeNull();
    expect(report.usage.rowsWithUnknownUsage).toBe(3);
  });
  it('rejects mismatched rubric criteria before running an evaluation', () => {
    expect(validateRubric(DEMO_EVALUATION_RUBRIC)).toMatchObject({
      isDemo: true,
      versionNo: 1,
    });
    expect(() =>
      validateRubric({
        ...DEMO_EVALUATION_RUBRIC,
        criteria: DEMO_EVALUATION_RUBRIC.criteria.slice(1),
      }),
    ).toThrow('one of each');
  });
});

import { BadRequestException } from '@nestjs/common';
import type { RubricCriterion, RevisionParagraph } from '@prisma/client';
import { band, object, text, uuid } from '../auth/validation.js';
export function validateAssessment(
  input: unknown,
  criteria: RubricCriterion[],
  paragraphs: RevisionParagraph[],
  skillIds: Set<string>,
) {
  const dto = object(input);
  if (
    !criteria.length ||
    !Array.isArray(dto.criteria) ||
    dto.criteria.length !== criteria.length
  )
    throw new BadRequestException(
      'Exactly one score per rubric criterion is required',
    );
  const scores = dto.criteria.map((value) => {
    const c = object(value);
    const criterion = criteria.find((x) => x.code === c.code);
    if (!criterion) throw new BadRequestException('Unknown criterion code');
    const score = band(c.score, 'criterion score');
    if (score > criterion.maxScore.toNumber())
      throw new BadRequestException('Score exceeds rubric maximum');
    return {
      criterionId: criterion.id,
      code: criterion.code,
      score,
      explanation: text(c.explanation, 'explanation'),
    };
  });
  if (new Set(scores.map((x) => x.criterionId)).size !== criteria.length)
    throw new BadRequestException('Duplicate criterion');
  const weight = criteria.reduce((sum, c) => sum + c.weight.toNumber(), 0);
  if (weight <= 0)
    throw new BadRequestException('Rubric weights must be positive');
  const overallScore =
    Math.round(
      (scores.reduce(
        (sum, s) =>
          sum +
          s.score *
            criteria.find((c) => c.id === s.criterionId)!.weight.toNumber(),
        0,
      ) /
        weight) *
        2,
    ) / 2;
  if (dto.overallBand !== undefined && band(dto.overallBand) !== overallScore)
    throw new BadRequestException(
      'Overall band must match weighted criterion scores',
    );
  if (
    dto.findings !== undefined &&
    (!Array.isArray(dto.findings) || dto.findings.length > 100)
  )
    throw new BadRequestException('Invalid findings');
  const findings = ((dto.findings ?? []) as unknown[]).map((value) => {
    const f = object(value);
    if (!['LOCAL', 'GLOBAL'].includes(String(f.kind)))
      throw new BadRequestException('Finding kind must be LOCAL or GLOBAL');
    const code = text(f.code, 'criterion code', 30);
    if (!scores.some((s) => s.code === code))
      throw new BadRequestException('Unknown finding criterion');
    const skillId = f.skillId == null ? null : uuid(f.skillId, 'skillId');
    if (skillId && !skillIds.has(skillId))
      throw new BadRequestException('Unknown or unpublished skill');
    if (
      !Array.isArray(f.anchors) ||
      f.anchors.length > 20 ||
      (f.kind === 'LOCAL' && !f.anchors.length)
    )
      throw new BadRequestException('Local findings require evidence anchors');
    const anchors = f.anchors.map((value) => {
      const a = object(value);
      const paragraph = paragraphs.find((p) => p.id === a.paragraphId);
      const quote = text(a.exactQuote, 'exactQuote', 10000);
      const startOffset = paragraph?.text.indexOf(quote) ?? -1;
      if (!paragraph || startOffset < 0)
        throw new BadRequestException(
          'Evidence quote is not in this revision paragraph',
        );
      return {
        paragraphId: paragraph.id,
        exactQuote: quote,
        startOffset,
        endOffset: startOffset + quote.length,
      };
    });
    return {
      code,
      skillId,
      findingKind: f.kind as string,
      explanation: text(f.explanation, 'finding explanation'),
      anchors,
    };
  });
  return {
    scores,
    overallScore,
    findings,
    summary: text(dto.summary, 'summary'),
  };
}
export type ValidatedAssessment = ReturnType<typeof validateAssessment>;

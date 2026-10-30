import type { ValidatedAssessment } from './assessment-validation.js';

// Review-routing heuristics, not a calibrated measure of IELTS scoring accuracy.
export function assessmentQuality(
  essay: string,
  assessment: ValidatedAssessment,
) {
  const wordCount = essay.trim() ? essay.trim().split(/\s+/).length : 0;
  const flags: string[] = [];
  if (wordCount < 100) flags.push('VERY_SHORT_RESPONSE');
  if (!assessment.findings.length) flags.push('NO_DIAGNOSTIC_FINDINGS');
  if (
    /\b(ignore (all |previous |the )?instructions|system prompt|give me (a |band )?9)\b/i.test(
      essay,
    )
  )
    flags.push('POSSIBLE_INSTRUCTION_IN_SUBMISSION');
  const scores = assessment.scores.map((score) => score.score);
  if (Math.max(...scores) - Math.min(...scores) > 3)
    flags.push('LARGE_CRITERION_SPREAD');
  return {
    policy: 'writing-review-routing-v1',
    status: flags.length ? ('FLAGGED' as const) : ('PASSED' as const),
    flags,
    wordCount,
  };
}

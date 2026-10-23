import { ServiceUnavailableException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
export function matchesAnswer(
  ruleJson: Prisma.JsonValue,
  acceptedTexts: Prisma.JsonValue | null,
  correctOptions: string[],
  response: { textAnswer: string | null; optionIds: string[] },
): boolean {
  if (!ruleJson || typeof ruleJson !== 'object' || Array.isArray(ruleJson))
    throw new ServiceUnavailableException('Invalid answer key rule');
  const rule = ruleJson;
  if (rule.method === 'EXACT_OPTION_SET') {
    if (rule.partialCredit === true)
      throw new ServiceUnavailableException(
        'Partial-credit rules are not supported',
      );
    const actual = [...response.optionIds].sort(),
      expected = [...correctOptions].sort();
    return (
      expected.length > 0 &&
      actual.length === expected.length &&
      actual.every((v, i) => v === expected[i])
    );
  }
  if (
    rule.method !== 'TEXT_EXACT' ||
    !Array.isArray(acceptedTexts) ||
    !acceptedTexts.length ||
    !acceptedTexts.every((v) => typeof v === 'string')
  )
    throw new ServiceUnavailableException('Unsupported answer key rule');
  if (!response.textAnswer?.trim()) return false;
  const normalize = (value: string) => {
    let s = value;
    if (rule.trim !== false) s = s.trim();
    if (rule.collapseSpaces === true) s = s.replace(/\s+/g, ' ');
    if (rule.caseSensitive !== true) s = s.toLocaleLowerCase('en');
    return s;
  };
  if (
    typeof rule.maxWords === 'number' &&
    response.textAnswer.trim().split(/\s+/).length > rule.maxWords
  )
    return false;
  return acceptedTexts.some(
    (value) => normalize(value as string) === normalize(response.textAnswer!),
  );
}

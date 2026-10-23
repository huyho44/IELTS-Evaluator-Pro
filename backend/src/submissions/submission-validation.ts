import { BadRequestException } from '@nestjs/common';
import type { ResponseMode } from '@prisma/client';
import { object, text, uuid } from '../auth/validation.js';
export function submissionPayload(
  input: unknown,
  mode: ResponseMode,
): {
  writingText: string | null;
  audioAssetId: string | null;
  itemResponses: {
    assessmentItemId: string;
    textAnswer: string | null;
    optionIds: string[];
  }[];
} {
  const dto = object(input);
  const writing = dto.writingText ?? dto.contentText;
  if (
    dto.writingText !== undefined &&
    dto.contentText !== undefined &&
    dto.writingText !== dto.contentText
  )
    throw new BadRequestException('Conflicting writingText and contentText');
  if (mode === 'WRITING') {
    if (dto.audioAssetId != null || dto.itemResponses != null)
      throw new BadRequestException('Writing only accepts text');
    return {
      writingText: text(writing, 'writingText', 100000),
      audioAssetId: null,
      itemResponses: [],
    };
  }
  if (mode === 'SPEAKING') {
    if (writing != null || dto.itemResponses != null)
      throw new BadRequestException('Speaking only accepts audioAssetId');
    return {
      writingText: null,
      audioAssetId: uuid(dto.audioAssetId, 'audioAssetId'),
      itemResponses: [],
    };
  }
  if (
    writing != null ||
    dto.audioAssetId != null ||
    !Array.isArray(dto.itemResponses) ||
    dto.itemResponses.length > 200
  )
    throw new BadRequestException(
      'Objective submission requires itemResponses only (maximum 200)',
    );
  const responses = dto.itemResponses
    .map((value) => {
      const r = object(value);
      const assessmentItemId = uuid(r.assessmentItemId, 'assessmentItemId');
      if (
        r.textAnswer !== undefined &&
        (typeof r.textAnswer !== 'string' || r.textAnswer.length > 2000)
      )
        throw new BadRequestException('Invalid textAnswer');
      if (
        r.optionIds !== undefined &&
        (!Array.isArray(r.optionIds) || r.optionIds.length > 50)
      )
        throw new BadRequestException('Invalid optionIds');
      const optionIds = ((r.optionIds ?? []) as unknown[])
        .map((x) => uuid(x, 'optionId'))
        .sort();
      if (new Set(optionIds).size !== optionIds.length)
        throw new BadRequestException('Duplicate option');
      return {
        assessmentItemId,
        textAnswer: typeof r.textAnswer === 'string' ? r.textAnswer : null,
        optionIds,
      };
    })
    .sort((a, b) => a.assessmentItemId.localeCompare(b.assessmentItemId));
  if (
    new Set(responses.map((x) => x.assessmentItemId)).size !== responses.length
  )
    throw new BadRequestException('Duplicate assessment item');
  return { writingText: null, audioAssetId: null, itemResponses: responses };
}
export function paragraphs(value: string) {
  const result: {
    paragraphNo: number;
    text: string;
    startOffset: number;
    endOffset: number;
  }[] = [];
  // Offsets refer to the exact immutable text, including its original line endings.
  for (const match of value.matchAll(
    /[^\r\n]+(?:\r?\n(?!\s*\r?\n)[^\r\n]+)*/g,
  )) {
    const content = match[0].trim();
    if (!content) continue;
    const startOffset = match.index! + match[0].indexOf(content);
    result.push({
      paragraphNo: result.length + 1,
      text: content,
      startOffset,
      endOffset: startOffset + content.length,
    });
  }
  return result;
}

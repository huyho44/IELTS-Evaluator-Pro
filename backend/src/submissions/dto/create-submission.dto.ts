export class ItemResponseDto {
  assessmentItemId: string;
  textAnswer?: string;
  optionIds?: string[];
}
export class CreateSubmissionDto {
  attemptId: string;
  writingText?: string;
  contentText?: string;
  audioAssetId?: string;
  itemResponses?: ItemResponseDto[];
}

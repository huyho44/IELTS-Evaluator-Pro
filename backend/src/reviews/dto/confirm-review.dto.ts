export class ConfirmReviewDto {
  lockVersion: number;
  reason: string;
  summary: string;
  criteria: { code: string; score: number; explanation: string }[];
  findings?: {
    code: string;
    skillId?: string;
    kind: 'LOCAL' | 'GLOBAL';
    explanation: string;
    anchors: { paragraphId: string; exactQuote: string }[];
  }[];
  observations?: {
    skillId: string;
    outcome: 'MET' | 'PARTIAL' | 'NOT_MET' | 'NOT_OBSERVED';
    rationale: string;
  }[];
}

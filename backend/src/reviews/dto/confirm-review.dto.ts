export class ConfirmReviewDto{
    teacherId: number;
    scoreTa: number;
    scoreCc: number;
    scoreLr: number;
    scoreGra: number;
    overallBand ?: number;
    teacherFeedback: string;
}
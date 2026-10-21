export class CreateSubmissionDto {
    userId: number;
    contentText: string;
    type?: string // 'READING', 'LISTENING', 'WRITING_TASK_2'
}
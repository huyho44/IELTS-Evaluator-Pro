export type Course = {
    id: string
    title: string
    description: string
    category:
    | 'Writing Task 1'
    | 'Writing Task 2'
    | 'Reading & Listening'
    | null
    instructorName: string
    lessonCount: number | null
    enrolled: boolean | null
    progress: number | null
    enrollmentOpen?: boolean
    learningItemCount?: number
}
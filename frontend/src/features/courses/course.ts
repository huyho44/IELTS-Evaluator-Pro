export type Course = {
    id: string
    title: string
    description: string
    category: 'Writing Task 1' | 'Writing Task 2' | 'Reading & Listening'
    instructorName: string
    lessonCount: number
    enrolled: boolean
    progress: number | null
}
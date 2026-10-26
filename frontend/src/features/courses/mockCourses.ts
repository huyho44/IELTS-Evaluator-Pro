import type { Course } from './course'

export const mockCourses: Course[] = [
    {
        id: 'demo-task-1',
        title: 'Mastering Academic Writing Task 1',
        description:
            'Learn to select key features, write clear overviews and compare data accurately.',
        category: 'Writing Task 1',
        instructorName: 'Tuấn Phát',
        lessonCount: 12,
        enrolled: false,
        progress: null,
    },
    {
        id: 'demo-task-2',
        title: 'Coherence & Grammar for Task 2',
        description:
            'Build supported arguments, paragraph unity and clear cohesive writing.',
        category: 'Writing Task 2',
        instructorName: 'Tuấn Phát',
        lessonCount: 12,
        enrolled: true,
        progress: 33,
    },
    {
        id: 'demo-reading-listening',
        title: 'Full Reading & Listening Mock Prep',
        description:
            'Develop comprehension through guided lessons and objective practice.',
        category: 'Reading & Listening',
        instructorName: 'Tuấn Phát',
        lessonCount: 10,
        enrolled: true,
        progress: 80,
    },
]
import { sessionFetch as fetch } from "../auth/session";
import type { Course } from './course'

type CourseResponse = {
    id: string
    title: string
    description: string
    enrollmentOpen: boolean
    creator: {
        displayName: string
    }
    _count: {
        learningItems: number
        enrollments: number
    }
}

export async function getCourses(signal: AbortSignal): Promise<Course[]> {
    const response = await fetch('/api/courses', { signal })

    if (!response.ok) {
        throw new Error(`Unable to load courses (HTTP ${response.status}).`)
    }

    const data: CourseResponse[] = await response.json()

    if (!Array.isArray(data)) {
        throw new Error('The server returned an unexpected course response.')
    }

    return data.map((course) => ({
        id: course.id,
        title: course.title,
        description: course.description,
        category: null,
        instructorName: course.creator.displayName,
        lessonCount: null,
        enrolled: null,
        progress: null,
        enrollmentOpen: course.enrollmentOpen,
        learningItemCount: course._count.learningItems,
    }))
}
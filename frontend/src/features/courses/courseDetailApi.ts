import { isLessonProgress, type LessonProgress } from "./lessonProgress";
import { sessionFetch as fetch } from "../auth/session";
export type CourseSection = {
    id: string;
    title: string;
    position: number;
};

export type CourseLearningItem = {
    progress?: LessonProgress | null;
    id: string;
    sectionId: string | null;
    title: string;
    kind: string;
    position: number;
    lesson: {
        summary: string | null;
    } | null;
    practiceActivity: {
        skillArea: string;
        responseMode: string;
    } | null;
};

export type CourseDetail = {
    id: string;
    title: string;
    description: string;
    enrollmentOpen: boolean;
    creator: {
        id: string;
        displayName: string;
    };
    sections: CourseSection[];
    learningItems: CourseLearningItem[];
};

export async function getCourseDetail(
    courseId: string,
    signal: AbortSignal,
    accessToken?: string | null,
): Promise<CourseDetail> {
    const response = await fetch(
        `/api/courses/${encodeURIComponent(courseId)}`,
        { signal, headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined },
    );

    if (response.status === 404) {
        throw new Error("This course is unavailable or does not exist.");
    }

    if (response.status === 400) {
        throw new Error("The course link is invalid.");
    }

    if (!response.ok) {
        throw new Error(
            `Unable to load course details. Please try again. (HTTP ${response.status})`,
        );
    }

    const data: CourseDetail = await response.json();

    if (
        !data ||
        typeof data.id !== "string" ||
        typeof data.title !== "string" ||
        !Array.isArray(data.sections) ||
        !Array.isArray(data.learningItems) ||
        !data.learningItems.every(item => item && (item.progress == null || isLessonProgress(item.progress)))
    ) {
        throw new Error("The server returned an unexpected course format.");
    }

    return data;
}
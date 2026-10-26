export type LessonMaterial = {
    id: string;
    kind: "TEXT" | "URL" | "FILE";
    position: number;
    contentText: string | null;
    externalUrl: string | null;
    fileAssetId: string | null;
};

export type LessonDetail = {
    id: string;
    summary: string | null;
    learningItem: {
        title: string;
    };
    lessonMaterials: LessonMaterial[];
};

export type LessonCompletion = {
    lessonId: string;
    status: "COMPLETED";
    completedAt: string;
};

export class LessonApiError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "LessonApiError";
        this.status = status;
    }
}

function createAuthHeaders(accessToken: string): Headers {
    if (!accessToken.trim()) {
        throw new LessonApiError(
            "Please sign in to access this lesson.",
            401,
        );
    }

    return new Headers({
        Authorization: `Bearer ${accessToken}`,
    });
}

async function checkResponse(response: Response): Promise<void> {
    if (response.ok) {
        return;
    }

    let message = "Unable to load or update this lesson. Please try again.";

    switch (response.status) {
        case 400:
            message = "The lesson link or request is invalid.";
            break;

        case 401:
            message = "Your session is unavailable or has expired. Please sign in.";
            break;

        case 403:
            message = "You do not have access to this lesson. Check your enrollment.";
            break;

        case 404:
            message = "This lesson is unavailable or does not exist.";
            break;

        case 409:
            message = "This action is unavailable for your current enrollment.";
            break;
    }

    throw new LessonApiError(message, response.status);
}

function isNullableString(value: unknown): value is string | null {
    return value === null || typeof value === "string";
}

function isLessonMaterial(value: unknown): value is LessonMaterial {
    return (
        typeof value === "object" &&
        value !== null &&
        "id" in value &&
        typeof value.id === "string" &&
        "kind" in value &&
        (value.kind === "TEXT" ||
            value.kind === "URL" ||
            value.kind === "FILE") &&
        "position" in value &&
        typeof value.position === "number" &&
        "contentText" in value &&
        isNullableString(value.contentText) &&
        "externalUrl" in value &&
        isNullableString(value.externalUrl) &&
        "fileAssetId" in value &&
        isNullableString(value.fileAssetId)
    );
}

function isLessonDetail(value: unknown): value is LessonDetail {
    if (
        typeof value !== "object" ||
        value === null ||
        !("id" in value) ||
        typeof value.id !== "string" ||
        !("summary" in value) ||
        !isNullableString(value.summary) ||
        !("lessonMaterials" in value) ||
        !Array.isArray(value.lessonMaterials) ||
        !value.lessonMaterials.every(isLessonMaterial) ||
        !("learningItem" in value)
    ) {
        return false;
    }

    const item = value.learningItem;

    return (
        typeof item === "object" &&
        item !== null &&
        "title" in item &&
        typeof item.title === "string"
    );
}

function createLessonPath(courseId: string, lessonId: string): string {
    if (!courseId.trim() || !lessonId.trim()) {
        throw new LessonApiError("The lesson link is invalid.", 400);
    }

    return (
        `/api/courses/${encodeURIComponent(courseId)}` +
        `/lessons/${encodeURIComponent(lessonId)}`
    );
}

export async function getLesson(
    courseId: string,
    lessonId: string,
    accessToken: string,
    signal?: AbortSignal,
): Promise<LessonDetail> {
    const response = await fetch(createLessonPath(courseId, lessonId), {
        headers: createAuthHeaders(accessToken),
        signal,
    });

    await checkResponse(response);

    const data: unknown = await response.json();

    if (!isLessonDetail(data)) {
        throw new Error("The server returned an unexpected lesson format.");
    }

    return data;
}

export async function completeLesson(
    courseId: string,
    lessonId: string,
    accessToken: string,
): Promise<LessonCompletion> {
    const response = await fetch(
        `${createLessonPath(courseId, lessonId)}/complete`,
        {
            method: "POST",
            headers: createAuthHeaders(accessToken),
        },
    );

    await checkResponse(response);

    const data: unknown = await response.json();

    if (
        typeof data !== "object" ||
        data === null ||
        !("lessonId" in data) ||
        data.lessonId !== lessonId ||
        !("status" in data) ||
        data.status !== "COMPLETED" ||
        !("completedAt" in data) ||
        typeof data.completedAt !== "string"
    ) {
        throw new Error("The server returned an unexpected completion format.");
    }

    return {
        lessonId: data.lessonId,
        status: data.status,
        completedAt: data.completedAt,
    };
}
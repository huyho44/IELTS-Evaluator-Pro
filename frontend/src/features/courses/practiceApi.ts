import { sessionFetch as fetch } from "../auth/session";
export type PracticeAssignment = {
    id: string;
    title: string;
    activityId: string;
    assignmentVersions: {
        id: string;
        versionNo: number;
    }[];
};

export class PracticeApiError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "PracticeApiError";
        this.status = status;
    }
}

function isObject(
    value: unknown,
): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isAssignment(value: unknown): value is PracticeAssignment {
    if (
        !isObject(value) ||
        typeof value.id !== "string" ||
        typeof value.title !== "string" ||
        typeof value.activityId !== "string" ||
        !Array.isArray(value.assignmentVersions)
    ) {
        return false;
    }

    return value.assignmentVersions.every(
        (version: unknown) =>
            isObject(version) &&
            typeof version.id === "string" &&
            typeof version.versionNo === "number" &&
            Number.isInteger(version.versionNo),
    );
}

export async function getPracticeAssignments(
    courseId: string,
    activityId: string,
    accessToken: string,
    signal?: AbortSignal,
): Promise<PracticeAssignment[]> {
    if (!courseId.trim() || !activityId.trim()) {
        throw new PracticeApiError("The practice link is invalid.", 400);
    }

    if (!accessToken.trim()) {
        throw new PracticeApiError(
            "Please sign in to access this practice.",
            401,
        );
    }

    const response = await fetch(
        `/api/courses/${encodeURIComponent(courseId)}/assignments`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            signal,
        },
    );

    if (!response.ok) {
        let message = "Unable to load assignments. Please try again.";

        switch (response.status) {
            case 400:
                message = "The practice link is invalid.";
                break;
            case 401:
                message = "Your session has expired. Please sign in again.";
                break;
            case 403:
                message = "You do not have access to this course practice.";
                break;
            case 404:
                message = "This course is unavailable or does not exist.";
                break;
            case 409:
                message = "Practice is unavailable for your current enrollment.";
                break;
        }

        throw new PracticeApiError(message, response.status);
    }

    const data: unknown = await response.json();

    if (!Array.isArray(data) || !data.every(isAssignment)) {
        throw new Error("The server returned an unexpected assignment format.");
    }

    return data.filter(
        (assignment) =>
            assignment.activityId === activityId &&
            assignment.assignmentVersions.length > 0,
    );
}

export type PracticeAttempt = {
    id: string;
    assignmentId: string;
    attemptNo: number;
    status: string;
    expiresAt: string | null;
};

export type PracticeQuestion = {
    id: string;
    position: number;
    questionVersion: {
        questionType: string;
        promptText: string;
        questionOptions: {
            id: string;
            optionCode: string;
            contentText: string;
            position: number;
        }[];
    };
};

export type PracticeAttemptDetail = PracticeAttempt & {
    attemptDraft: PracticeDraft | null;
    submissionRevisions: {
        id: string;
        revisionNo: number;
        submittedAt: string;
    }[];
    assignmentVersion: {
        assignment: {
            title: string;
            courseId: string;
        };
        activityVersion: {
            promptText: string | null;
            instructions: string | null;
            assessmentItems: PracticeQuestion[];
        };
    };
};

function isAttempt(value: unknown): value is PracticeAttempt {
    return (
        isObject(value) &&
        typeof value.id === "string" &&
        typeof value.assignmentId === "string" &&
        typeof value.attemptNo === "number" &&
        Number.isInteger(value.attemptNo) &&
        typeof value.status === "string" &&
        (value.expiresAt === null || typeof value.expiresAt === "string")
    );
}

function isQuestion(value: unknown): value is PracticeQuestion {
    if (
        !isObject(value) ||
        typeof value.id !== "string" ||
        typeof value.position !== "number" ||
        !isObject(value.questionVersion)
    ) {
        return false;
    }

    const question = value.questionVersion;

    return (
        typeof question.questionType === "string" &&
        typeof question.promptText === "string" &&
        Array.isArray(question.questionOptions) &&
        question.questionOptions.every(
            (option: unknown) =>
                isObject(option) &&
                typeof option.id === "string" &&
                typeof option.optionCode === "string" &&
                typeof option.contentText === "string" &&
                typeof option.position === "number",
        )
    );
}

function isAttemptDetail(value: unknown): value is PracticeAttemptDetail {
    if (
        !isAttempt(value) ||
        !("submissionRevisions" in value) ||
        !Array.isArray(value.submissionRevisions) ||
        !value.submissionRevisions.every(
            (revision: unknown) =>
                isObject(revision) &&
                typeof revision.id === "string" &&
                typeof revision.revisionNo === "number" &&
                typeof revision.submittedAt === "string",
        ) ||
        !("attemptDraft" in value) ||
        (value.attemptDraft !== null && !isPracticeDraft(value.attemptDraft)) ||
        !("assignmentVersion" in value) ||
        !isObject(value.assignmentVersion)
    ) {
        return false;
    }

    const version = value.assignmentVersion;

    if (
        !isObject(version.assignment) ||
        typeof version.assignment.title !== "string" ||
        typeof version.assignment.courseId !== "string" ||
        !isObject(version.activityVersion)
    ) {
        return false;
    }

    const activity = version.activityVersion;

    return (
        (activity.promptText === null ||
            typeof activity.promptText === "string") &&
        (activity.instructions === null ||
            typeof activity.instructions === "string") &&
        Array.isArray(activity.assessmentItems) &&
        activity.assessmentItems.every(isQuestion)
    );
}

async function requestPractice(
    path: string,
    accessToken: string,
    method: "GET" | "POST",
    signal?: AbortSignal,
): Promise<unknown> {
    if (!accessToken.trim()) {
        throw new PracticeApiError("Please sign in to continue.", 401);
    }

    const response = await fetch(path, {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
        signal,
    });

    if (!response.ok) {
        let message = "Unable to open this attempt. Please try again.";

        // Preserve backend messages such as maximum attempts or closed deadlines.
        try {
            const body: unknown = await response.json();

            if (isObject(body) && typeof body.message === "string") {
                message = body.message;
            }
        } catch {
            // Keep the fallback message if the response is not JSON.
        }

        if (response.status === 401) {
            message = "Your session has expired. Please sign in again.";
        }

        throw new PracticeApiError(message, response.status);
    }

    return response.json();
}

export async function startPracticeAttempt(
    assignmentId: string,
    accessToken: string,
): Promise<PracticeAttempt> {
    if (!assignmentId.trim()) {
        throw new PracticeApiError("The assignment link is invalid.", 400);
    }

    const data = await requestPractice(
        `/api/assignments/${encodeURIComponent(assignmentId)}/attempts`,
        accessToken,
        "POST",
    );

    if (!isAttempt(data) || data.assignmentId !== assignmentId) {
        throw new Error("The server returned an unexpected attempt format.");
    }

    return data;
}

export async function getPracticeAttempt(
    attemptId: string,
    accessToken: string,
    signal?: AbortSignal,
): Promise<PracticeAttemptDetail> {
    if (!attemptId.trim()) {
        throw new PracticeApiError("The attempt link is invalid.", 400);
    }

    const data = await requestPractice(
        `/api/attempts/${encodeURIComponent(attemptId)}`,
        accessToken,
        "GET",
        signal,
    );

    if (!isAttemptDetail(data) || data.id !== attemptId) {
        throw new Error("The server returned an unexpected practice format.");
    }

    return data;
}

export type PracticeResponse = {
    assessmentItemId: string;
    textAnswer: string | null;
    optionIds: string[];
};

export type PracticeDraft = {
    lockVersion: number;
    payloadJson: {
        itemResponses: PracticeResponse[];
    };
};

function isPracticeResponse(value: unknown): value is PracticeResponse {
    return (
        isObject(value) &&
        typeof value.assessmentItemId === "string" &&
        (value.textAnswer === null || typeof value.textAnswer === "string") &&
        Array.isArray(value.optionIds) &&
        value.optionIds.every((id: unknown) => typeof id === "string")
    );
}

function isPracticeDraft(value: unknown): value is PracticeDraft {
    return (
        isObject(value) &&
        typeof value.lockVersion === "number" &&
        Number.isInteger(value.lockVersion) &&
        isObject(value.payloadJson) &&
        Array.isArray(value.payloadJson.itemResponses) &&
        value.payloadJson.itemResponses.every(isPracticeResponse)
    );
}

export async function savePracticeDraft(
    attemptId: string,
    accessToken: string,
    lockVersion: number,
    itemResponses: PracticeResponse[],
): Promise<PracticeDraft> {
    if (!accessToken.trim()) {
        throw new PracticeApiError("Please sign in to save your answers.", 401);
    }

    const response = await fetch(
        `/api/attempts/${encodeURIComponent(attemptId)}/draft`,
        {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                lockVersion,
                payload: { itemResponses },
            }),
        },
    );

    if (!response.ok) {
        let message = "Unable to save your draft. Please try again.";

        if (response.status === 401) {
            message = "Your session has expired. Please sign in again.";
        } else {
            try {
                const body: unknown = await response.json();

                if (isObject(body) && typeof body.message === "string") {
                    message = body.message;
                }
            } catch {
                // Keep the fallback message.
            }
        }

        throw new PracticeApiError(message, response.status);
    }

    const data: unknown = await response.json();

    if (!isPracticeDraft(data)) {
        throw new Error("The server returned an unexpected draft format.");
    }

    return data;
}

export type PracticeReceipt = {
    submissionId: string;
    attemptId: string;
    status: string;
};

export async function submitPracticeAttempt(
    assignmentId: string,
    attemptId: string,
    accessToken: string,
    itemResponses: PracticeResponse[],
): Promise<PracticeReceipt> {
    if (!accessToken.trim()) {
        throw new PracticeApiError("Please sign in to submit.", 401);
    }

    const response = await fetch(
        `/api/assignments/${encodeURIComponent(assignmentId)}/submissions`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                attemptId,
                itemResponses: itemResponses.map((answer) => ({
                    assessmentItemId: answer.assessmentItemId,
                    optionIds: answer.optionIds,
                    ...(answer.textAnswer !== null
                        ? { textAnswer: answer.textAnswer }
                        : {}),
                })),
            }),
        },
    );

    if (!response.ok) {
        let message = "Unable to submit. Please try again.";

        try {
            const body: unknown = await response.json();

            if (isObject(body) && typeof body.message === "string") {
                message = body.message;
            }
        } catch {
            // Keep the fallback message.
        }

        if (response.status === 401) {
            message = "Your session has expired. Please sign in again.";
        }

        throw new PracticeApiError(message, response.status);
    }

    const data: unknown = await response.json();

    if (
        !isObject(data) ||
        typeof data.submissionId !== "string" ||
        data.attemptId !== attemptId ||
        typeof data.status !== "string"
    ) {
        throw new Error(
            "The submission response could not be verified. Check submission history before retrying.",
        );
    }

    return {
        submissionId: data.submissionId,
        attemptId: data.attemptId,
        status: data.status,
    };
}

export async function getPracticeSubmissionStatus(
    submissionId: string,
    accessToken: string,
): Promise<PracticeReceipt> {
    const data = await requestPractice(
        `/api/submissions/${encodeURIComponent(submissionId)}`,
        accessToken,
        "GET",
    );

    if (
        !isObject(data) ||
        data.id !== submissionId ||
        typeof data.attemptId !== "string" ||
        !isObject(data.processing) ||
        typeof data.processing.status !== "string"
    ) {
        throw new Error("The server returned an unexpected submission format.");
    }

    return {
        submissionId: data.id,
        attemptId: data.attemptId,
        status: data.processing.status,
    };
}

export type PracticeHistoryEntry = {
    id: string;
    assignmentId: string;
    attemptNo: number;
    status: string;
    startedAt: string;
    submissionRevisions: {
        id: string;
        revisionNo: number;
        submittedAt: string;
    }[];
};

export async function getPracticeHistory(
    accessToken: string,
    signal?: AbortSignal,
): Promise<PracticeHistoryEntry[]> {
    const data = await requestPractice(
        "/api/me/submissions",
        accessToken,
        "GET",
        signal,
    );

    if (
        !Array.isArray(data) ||
        !data.every(
            (entry: unknown) =>
                isObject(entry) &&
                typeof entry.id === "string" &&
                typeof entry.assignmentId === "string" &&
                typeof entry.attemptNo === "number" &&
                typeof entry.status === "string" &&
                typeof entry.startedAt === "string" &&
                Array.isArray(entry.submissionRevisions) &&
                entry.submissionRevisions.every(
                    (revision: unknown) =>
                        isObject(revision) &&
                        typeof revision.id === "string" &&
                        typeof revision.revisionNo === "number" &&
                        typeof revision.submittedAt === "string",
                ),
        )
    ) {
        throw new Error("The server returned an unexpected history format.");
    }

    return data;
}

export async function getSubmittedPractice(
    submissionId: string,
    accessToken: string,
    signal?: AbortSignal,
): Promise<{
    receipt: PracticeReceipt;
    itemResponses: PracticeResponse[];
}> {
    const data = await requestPractice(
        `/api/submissions/${encodeURIComponent(submissionId)}`,
        accessToken,
        "GET",
        signal,
    );

    if (
        !isObject(data) ||
        data.id !== submissionId ||
        typeof data.attemptId !== "string" ||
        data.responseMode !== "OBJECTIVE" ||
        !isObject(data.processing) ||
        typeof data.processing.status !== "string" ||
        !Array.isArray(data.itemResponses)
    ) {
        throw new Error("The server returned an unexpected submission format.");
    }

    const itemResponses: PracticeResponse[] = [];

    for (const response of data.itemResponses) {
        if (
            !isObject(response) ||
            typeof response.assessmentItemId !== "string" ||
            (response.textAnswer !== null &&
                typeof response.textAnswer !== "string") ||
            !Array.isArray(response.responseSelections)
        ) {
            throw new Error("The server returned an invalid submitted answer.");
        }

        const optionIds: string[] = [];

        for (const selection of response.responseSelections) {
            if (!isObject(selection) || typeof selection.optionId !== "string") {
                throw new Error("The server returned an invalid submitted selection.");
            }

            optionIds.push(selection.optionId);
        }

        itemResponses.push({
            assessmentItemId: response.assessmentItemId,
            textAnswer: response.textAnswer,
            optionIds,
        });
    }

    return {
        receipt: {
            submissionId: data.id,
            attemptId: data.attemptId,
            status: data.processing.status,
        },
        itemResponses,
    };
}
export type PracticeAssessment = {
  id: string;
  isOfficial: boolean;
  summary: string | null;
  rawScore: number;
  maxScore: number;
};

function parseScore(value: unknown): number {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !value.trim())
  ) {
    throw new Error("The server returned an invalid score.");
  }

  const score = Number(value);

  if (!Number.isFinite(score) || score < 0) {
    throw new Error("The server returned an invalid score.");
  }

  return score;
}

export async function getPracticeAssessments(
  submissionId: string,
  accessToken: string,
  signal?: AbortSignal,
): Promise<PracticeAssessment[]> {
  const data = await requestPractice(
    `/api/submission-revisions/${encodeURIComponent(submissionId)}/assessment`,
    accessToken,
    "GET",
    signal,
  );

  if (
    !isObject(data) ||
    data.revisionId !== submissionId ||
    !Array.isArray(data.assessments)
  ) {
    throw new Error("The server returned an unexpected assessment format.");
  }

  const results: PracticeAssessment[] = [];

  for (const assessment of data.assessments) {
    if (!isObject(assessment)) {
      throw new Error("The server returned an invalid assessment.");
    }

    // This panel currently supports answer-key Reading results.
    if (assessment.kind !== "ANSWER_KEY") continue;

    if (
      typeof assessment.id !== "string" ||
      typeof assessment.isOfficial !== "boolean" ||
      assessment.scoreScale !== "RAW" ||
      (assessment.summary !== null &&
        typeof assessment.summary !== "string") ||
      !isObject(assessment.answerKeyResult)
    ) {
      throw new Error("The server returned an invalid Reading result.");
    }

    const rawScore = parseScore(assessment.answerKeyResult.rawScore);
    const maxScore = parseScore(assessment.answerKeyResult.maxScore);

    if (rawScore > maxScore) {
      throw new Error("The score exceeds the maximum marks.");
    }

    results.push({
      id: assessment.id,
      isOfficial: assessment.isOfficial,
      summary: assessment.summary,
      rawScore,
      maxScore,
    });
  }

  return results;
}

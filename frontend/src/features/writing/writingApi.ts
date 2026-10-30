import { isRecord, studentRequest } from "../../lib/api/studentRequest";

export type RevisionSummary = {
  id: string;
  revisionNo: number;
  submittedAt: string;
};
export function selectRevisionId(
  revisions: RevisionSummary[],
  requestedId: string | null,
): string {
  if (requestedId && revisions.some((revision) => revision.id === requestedId))
    return requestedId;
  return (
    [...revisions].sort(
      (first, second) => second.revisionNo - first.revisionNo,
    )[0]?.id ?? ""
  );
}
export type StudentAttempt = {
  id: string;
  assignmentId: string;
  attemptNo: number;
  status: string;
  expiresAt: string | null;
  attemptDraft: {
    lockVersion: number;
    payloadJson: { writingText?: string };
  } | null;
  submissionRevisions: RevisionSummary[];
  assignmentVersion: {
    id: string;
    mode: "PRACTICE" | "GRADED";
    maxRevisions: number;
    dueAt: string | null;
    allowLate: boolean;
    assignment: {
      title: string;
      courseId: string;
      activity: {
        responseMode: "WRITING" | "OBJECTIVE" | "SPEAKING";
        skillArea: string;
      };
    };
    activityVersion: { id: string; promptText: string; instructions: string };
    rubricVersion: {
      rubricCode: string;
      versionNo: number;
      rubricCriterions: { code: string; name: string }[];
    } | null;
  };
};
export type SubmissionReceipt = {
  revisionId: string;
  submissionId: string;
  attemptId: string;
  status: string;
  gradingRunId: string | null;
  reviewCaseId: string | null;
};
export type WritingRevision = RevisionSummary & {
  attemptId: string;
  responseMode: "WRITING";
  writingText: string;
  paragraphs: { id: string; paragraphNo: number; text: string }[];
  processing: SubmissionReceipt;
};
export type Appeal = {
  id: string;
  status: string;
  reason: string;
  resolution: string | null;
  requestedAt: string;
  resolvedAt: string | null;
};
export type WritingAssessment = {
  id: string;
  revisionId: string;
  kind: "AI" | "TEACHER";
  overallScore: string | number | null;
  summary: string | null;
  isOfficial: boolean;
  provisional: boolean;
  createdAt: string;
  criterionScores: {
    id: string;
    score: string | number;
    explanation: string | null;
    criterion: { code: string; name: string };
  }[];
  findings: {
    id: string;
    explanation: string;
    findingKind: string;
    findingAnchors: { paragraphId: string; exactQuote: string }[];
  }[];
  acceptedAssessment: {
    id: string;
    isCurrent: boolean;
    publishedAt: string | null;
    appeals?: Appeal[];
  } | null;
};

function revisionSummary(value: unknown): value is RevisionSummary {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    Number.isInteger(value.revisionNo) &&
    typeof value.submittedAt === "string"
  );
}
export function parseAttempt(
  value: unknown,
  expectedId: string,
): StudentAttempt {
  if (
    !isRecord(value) ||
    value.id !== expectedId ||
    typeof value.assignmentId !== "string" ||
    !Number.isInteger(value.attemptNo) ||
    typeof value.status !== "string" ||
    !(value.expiresAt === null || typeof value.expiresAt === "string") ||
    !Array.isArray(value.submissionRevisions) ||
    !value.submissionRevisions.every(revisionSummary) ||
    !isRecord(value.assignmentVersion)
  )
    throw new Error("The attempt response could not be verified.");
  const version = value.assignmentVersion;
  if (
    typeof version.id !== "string" ||
    !["PRACTICE", "GRADED"].includes(String(version.mode)) ||
    !Number.isInteger(version.maxRevisions) ||
    !isRecord(version.assignment) ||
    typeof version.assignment.title !== "string" ||
    typeof version.assignment.courseId !== "string" ||
    !isRecord(version.assignment.activity) ||
    !["WRITING", "OBJECTIVE", "SPEAKING"].includes(
      String(version.assignment.activity.responseMode),
    ) ||
    !isRecord(version.activityVersion) ||
    typeof version.activityVersion.promptText !== "string" ||
    typeof version.activityVersion.instructions !== "string"
  )
    throw new Error("The assignment details could not be verified.");
  if (
    value.attemptDraft !== null &&
    (!isRecord(value.attemptDraft) ||
      !Number.isInteger(value.attemptDraft.lockVersion) ||
      !isRecord(value.attemptDraft.payloadJson) ||
      (value.attemptDraft.payloadJson.writingText !== undefined &&
        typeof value.attemptDraft.payloadJson.writingText !== "string"))
  ) {
    throw new Error(
      "The saved draft could not be verified. Reload before editing.",
    );
  }
  return value as StudentAttempt;
}
export function parseReceipt(
  value: unknown,
  attemptId: string,
): SubmissionReceipt {
  if (
    !isRecord(value) ||
    value.attemptId !== attemptId ||
    typeof value.revisionId !== "string" ||
    value.submissionId !== value.revisionId ||
    typeof value.status !== "string"
  )
    throw new Error(
      "The submission response could not be verified. Refresh its status before retrying.",
    );
  return value as SubmissionReceipt;
}
export async function getStudentAttempt(
  id: string,
  token: string,
  signal?: AbortSignal,
) {
  return parseAttempt(
    await studentRequest(`/attempts/${encodeURIComponent(id)}`, token, {
      signal,
    }),
    id,
  );
}
export async function saveWritingDraft(
  id: string,
  token: string,
  lockVersion: number,
  writingText: string,
) {
  const value = await studentRequest(
    `/attempts/${encodeURIComponent(id)}/draft`,
    token,
    { method: "PUT", body: { lockVersion, payload: { writingText } } },
  );
  if (!isRecord(value) || !Number.isInteger(value.lockVersion))
    throw new Error(
      "Draft saving could not be verified. Check the saved draft before retrying.",
    );
  return { lockVersion: value.lockVersion as number };
}
export async function submitWriting(
  attempt: StudentAttempt,
  token: string,
  writingText: string,
) {
  if (!writingText.trim() || writingText.length > 100000)
    throw new Error("Enter an essay of at most 100,000 characters.");
  return parseReceipt(
    await studentRequest(
      `/assignments/${encodeURIComponent(attempt.assignmentId)}/submissions`,
      token,
      {
        method: "POST",
        body: { attemptId: attempt.id, writingText },
      },
    ),
    attempt.id,
  );
}
export async function reopenWriting(id: string, token: string) {
  const value = await studentRequest(
    `/attempts/${encodeURIComponent(id)}/revise`,
    token,
    { method: "POST" },
  );
  if (!isRecord(value) || value.id !== id || value.status !== "IN_PROGRESS")
    throw new Error(
      "Reopening could not be verified. Reload the attempt status.",
    );
}
export async function getWritingRevision(
  id: string,
  attemptId: string,
  token: string,
  signal?: AbortSignal,
): Promise<WritingRevision> {
  const value = await studentRequest(
    `/submissions/${encodeURIComponent(id)}`,
    token,
    { signal },
  );
  if (
    !isRecord(value) ||
    value.id !== id ||
    !Number.isInteger(value.revisionNo) ||
    typeof value.submittedAt !== "string" ||
    value.attemptId !== attemptId ||
    value.responseMode !== "WRITING" ||
    typeof value.writingText !== "string" ||
    !Array.isArray(value.paragraphs) ||
    !value.paragraphs.every(
      (p) =>
        isRecord(p) &&
        typeof p.id === "string" &&
        typeof p.text === "string" &&
        Number.isInteger(p.paragraphNo),
    )
  ) {
    throw new Error(
      "This revision could not be verified for your Writing attempt.",
    );
  }
  parseReceipt(value.processing, attemptId);
  return value as WritingRevision;
}
function band(value: unknown): value is string | number {
  return (
    (typeof value === "number" ||
      (typeof value === "string" && !!value.trim())) &&
    Number.isFinite(Number(value)) &&
    Number(value) >= 0 &&
    Number(value) <= 9
  );
}
export function parseWritingAssessments(
  value: unknown,
  revisionId: string,
): WritingAssessment[] {
  if (
    !isRecord(value) ||
    value.revisionId !== revisionId ||
    !Array.isArray(value.assessments)
  )
    throw new Error("Feedback could not be verified for this revision.");
  const results: WritingAssessment[] = [];
  for (const item of value.assessments) {
    if (
      !isRecord(item) ||
      !["AI", "TEACHER"].includes(String(item.kind)) ||
      item.scoreScale !== "BAND" ||
      typeof item.id !== "string" ||
      item.revisionId !== revisionId ||
      typeof item.isOfficial !== "boolean" ||
      !(item.overallScore === null || band(item.overallScore)) ||
      !(item.summary === null || typeof item.summary === "string") ||
      !Array.isArray(item.criterionScores) ||
      !item.criterionScores.every(
        (c) =>
          isRecord(c) &&
          typeof c.id === "string" &&
          band(c.score) &&
          isRecord(c.criterion) &&
          typeof c.criterion.code === "string" &&
          typeof c.criterion.name === "string" &&
          (c.explanation === null || typeof c.explanation === "string"),
      ) ||
      !Array.isArray(item.findings) ||
      !item.findings.every(
        (f) =>
          isRecord(f) &&
          typeof f.id === "string" &&
          typeof f.explanation === "string" &&
          Array.isArray(f.findingAnchors) &&
          f.findingAnchors.every(
            (a) =>
              isRecord(a) &&
              typeof a.paragraphId === "string" &&
              typeof a.exactQuote === "string",
          ),
      )
    ) {
      throw new Error("The server returned feedback in an unexpected format.");
    }
    if (
      item.acceptedAssessment !== null &&
      (!isRecord(item.acceptedAssessment) ||
        typeof item.acceptedAssessment.id !== "string" ||
        typeof item.acceptedAssessment.isCurrent !== "boolean" ||
        !(
          item.acceptedAssessment.publishedAt === null ||
          typeof item.acceptedAssessment.publishedAt === "string"
        ))
    ) {
      throw new Error("The feedback publication status could not be verified.");
    }
    if (
      isRecord(item.acceptedAssessment) &&
      item.acceptedAssessment.appeals !== undefined &&
      (!Array.isArray(item.acceptedAssessment.appeals) ||
        !item.acceptedAssessment.appeals.every(
          (appeal) =>
            isRecord(appeal) &&
            typeof appeal.id === "string" &&
            typeof appeal.status === "string" &&
            typeof appeal.reason === "string" &&
            (appeal.resolution === null ||
              typeof appeal.resolution === "string"),
        ))
    ) {
      throw new Error("The assessment review history could not be verified.");
    }
    // Official feedback must be a published instructor decision, never raw AI output.
    results.push({
      ...item,
      isOfficial:
        item.kind === "TEACHER" &&
        item.isOfficial &&
        isRecord(item.acceptedAssessment) &&
        typeof item.acceptedAssessment.publishedAt === "string",
      provisional: item.kind === "AI",
    } as WritingAssessment);
  }
  return results.sort((a, b) => Number(b.isOfficial) - Number(a.isOfficial));
}
export async function getWritingAssessments(
  id: string,
  token: string,
  signal?: AbortSignal,
) {
  return parseWritingAssessments(
    await studentRequest(
      `/submission-revisions/${encodeURIComponent(id)}/assessment`,
      token,
      { signal },
    ),
    id,
  );
}
export async function appealWriting(
  acceptedId: string,
  reason: string,
  token: string,
) {
  if (!reason.trim() || reason.length > 10000)
    throw new Error("Enter a reason of at most 10,000 characters.");
  const value = await studentRequest(
    `/assessments/${encodeURIComponent(acceptedId)}/appeals`,
    token,
    { method: "POST", body: { reason: reason.trim() } },
  );
  if (!isRecord(value) || typeof value.id !== "string")
    throw new Error(
      "The appeal response could not be verified. Refresh before retrying.",
    );
  return value;
}
export async function requestWritingReview(
  revisionId: string,
  reason: string,
  token: string,
) {
  if (!reason.trim() || reason.length > 10000)
    throw new Error("Enter a reason of at most 10,000 characters.");
  const value = await studentRequest(
    `/submission-revisions/${encodeURIComponent(revisionId)}/review-requests`,
    token,
    { method: "POST", body: { reason: reason.trim() } },
  );
  if (!isRecord(value) || typeof value.id !== "string")
    throw new Error(
      "The review request could not be verified. Refresh before retrying.",
    );
  return value;
}

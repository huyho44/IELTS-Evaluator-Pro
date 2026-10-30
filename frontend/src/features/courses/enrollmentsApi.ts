import { sessionFetch as fetch } from "../auth/session";
export type EnrollmentStatus = "ACTIVE" | "COMPLETED" | "LEFT";

export type Enrollment = {
  id: string;
  courseId: string;
  status: EnrollmentStatus;
};

export type EnrolledCourse = {
  id: string;
  title: string;
  description: string;
  enrollmentOpen: boolean;
};

export type MyEnrollment = Enrollment & {
  course: EnrolledCourse;
};

export class EnrollmentApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "EnrollmentApiError";
    this.status = status;
  }
}

function createAuthHeaders(accessToken: string): Headers {
  if (!accessToken.trim()) {
    throw new EnrollmentApiError("Please sign in to continue.", 401);
  }

  return new Headers({
    Authorization: `Bearer ${accessToken}`,
  });
}

async function checkResponse(
  response: Response,
  fallbackMessage: string,
): Promise<void> {
  if (response.ok) {
    return;
  }

  let message = fallbackMessage;

  switch (response.status) {
    case 400:
      message = "The enrollment request is invalid.";
      break;

    case 401:
      message = "Your session is unavailable or has expired. Please sign in.";
      break;

    case 403:
      message = "Your account does not have permission to perform this action.";
      break;

    case 404:
      message = "This course is unavailable or does not exist.";
      break;

    case 409:
      // Preserve the backend's reason, such as closed enrollment
      // or an existing enrollment.
      try {
        const body: unknown = await response.json();

        if (
          typeof body === "object" &&
          body !== null &&
          "message" in body &&
          typeof body.message === "string"
        ) {
          message = body.message;
        }
      } catch {
        // Keep the fallback if the response is not valid JSON.
      }
      break;
  }

  throw new EnrollmentApiError(message, response.status);
}

function isEnrollment(value: unknown): value is Enrollment {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "courseId" in value &&
    typeof value.courseId === "string" &&
    "status" in value &&
    (value.status === "ACTIVE" ||
      value.status === "COMPLETED" ||
      value.status === "LEFT")
  );
}

function isMyEnrollment(value: unknown): value is MyEnrollment {
  if (!isEnrollment(value) || !("course" in value)) {
    return false;
  }

  const course = value.course;

  return (
    typeof course === "object" &&
    course !== null &&
    "id" in course &&
    typeof course.id === "string" &&
    "title" in course &&
    typeof course.title === "string" &&
    "description" in course &&
    typeof course.description === "string" &&
    "enrollmentOpen" in course &&
    typeof course.enrollmentOpen === "boolean"
  );
}

export async function getMyEnrollments(
  accessToken: string,
  signal?: AbortSignal,
): Promise<MyEnrollment[]> {
  const response = await fetch("/api/courses/mine", {
    headers: createAuthHeaders(accessToken),
    signal,
  });

  await checkResponse(
    response,
    "Unable to load your enrolled courses. Please try again.",
  );

  const data: unknown = await response.json();

  if (!Array.isArray(data) || !data.every(isMyEnrollment)) {
    throw new Error("The server returned an unexpected enrollment format.");
  }

  return data;
}

export async function enrollInCourse(
  courseId: string,
  accessToken: string,
): Promise<Enrollment> {
  if (!courseId.trim()) {
    throw new Error("A course ID is required.");
  }

  const response = await fetch(
    `/api/courses/${encodeURIComponent(courseId)}/enroll`,
    {
      method: "POST",
      headers: createAuthHeaders(accessToken),
    },
  );

  await checkResponse(
    response,
    "Unable to enroll in this course. Please try again.",
  );

  const data: unknown = await response.json();

  if (!isEnrollment(data)) {
    throw new Error("The server returned an unexpected enrollment format.");
  }

  return data;
}

export async function checkCourseCompletion(
  courseId: string,
  accessToken: string,
): Promise<{
  status: "ACTIVE" | "COMPLETED";
  remainingItemIds: string[];
}> {
  const response = await fetch(
    `/api/courses/${encodeURIComponent(courseId)}/completion`,
    {
      method: "POST",
      headers: createAuthHeaders(accessToken),
    },
  );
  await checkResponse(
    response,
    "Unable to check course completion. Please try again.",
  );
  const data: unknown = await response.json();
  if (
    typeof data !== "object" ||
    data === null ||
    !("status" in data) ||
    (data.status !== "ACTIVE" && data.status !== "COMPLETED") ||
    ("courseId" in data && data.courseId !== courseId) ||
    (data.status === "ACTIVE" && !("remainingItemIds" in data)) ||
    ("remainingItemIds" in data &&
      (!Array.isArray(data.remainingItemIds) ||
        !data.remainingItemIds.every((id) => typeof id === "string")))
  ) {
    throw new Error("The course completion response could not be verified.");
  }
  return {
    status: data.status,
    remainingItemIds:
      "remainingItemIds" in data ? (data.remainingItemIds as string[]) : [],
  };
}

import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useSession } from "../auth/session";
import {
  EnrollmentApiError,
  enrollInCourse,
  getMyEnrollments,
  checkCourseCompletion,
  type EnrollmentStatus,
} from "./enrollmentsApi";

type CourseEnrollmentPanelProps = {
  courseId: string;
  enrollmentOpen: boolean;
  accessToken: string | null;
};

type PanelProps = CourseEnrollmentPanelProps;

function EnrollmentPanel({
  courseId,
  enrollmentOpen,
  accessToken,
}: PanelProps) {
  const { session } = useSession();
  const [status, setStatus] = useState<EnrollmentStatus | null>(null);
  const [loading, setLoading] = useState(Boolean(accessToken));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const mounted = useRef(false);
  const completionInFlight = useRef(false);
  const [checkingCompletion, setCheckingCompletion] = useState(false);
  const [completionMessage, setCompletionMessage] = useState("");

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const controller = new AbortController();

    async function loadEnrollment() {
      setLoading(true);
      setError("");
      setSessionExpired(false);

      try {
        const enrollments = await getMyEnrollments(
          accessToken!,
          controller.signal,
        );

        if (!controller.signal.aborted) {
          const enrollment = enrollments.find(
            (item) => item.courseId === courseId,
          );

          setStatus(enrollment?.status ?? null);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to check your enrollment.",
          );

          setSessionExpired(
            cause instanceof EnrollmentApiError && cause.status === 401,
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadEnrollment();

    return () => controller.abort();
  }, [courseId, accessToken, reloadKey]);

  async function handleEnroll() {
    if (
      !accessToken ||
      loading ||
      submitting ||
      !enrollmentOpen ||
      status !== null ||
      error
    ) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const enrollment = await enrollInCourse(courseId, accessToken);

      if (mounted.current) {
        setStatus(enrollment.status);
      }
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to enroll. Please try again.",
        );

        setSessionExpired(
          cause instanceof EnrollmentApiError && cause.status === 401,
        );
      }
    } finally {
      if (mounted.current) {
        setSubmitting(false);
      }
    }
  }

  async function handleCompletion() {
    if (
      !accessToken ||
      status !== "ACTIVE" ||
      completionInFlight.current ||
      !session?.user.roles.includes("LEARNER")
    )
      return;
    completionInFlight.current = true;
    setCheckingCompletion(true);
    setCompletionMessage("");
    setError("");
    try {
      const result = await checkCourseCompletion(courseId, accessToken);
      if (!mounted.current) return;
      setStatus(result.status);
      setCompletionMessage(
        result.status === "COMPLETED"
          ? "Course completed. Your progress has been saved."
          : `${result.remainingItemIds.length} required learning ${result.remainingItemIds.length === 1 ? "item remains" : "items remain"}. Complete the remaining content and check again. Required practices count after their confirmed results are published.`,
      );
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to check completion.",
        );
        setSessionExpired(
          cause instanceof EnrollmentApiError && cause.status === 401,
        );
      }
    } finally {
      completionInFlight.current = false;
      if (mounted.current) setCheckingCompletion(false);
    }
  }

  let buttonText = "Enroll in Course";
  let description = "Join this course to access its learning content.";

  if (!accessToken) {
    description = "Please sign in to enroll in this course.";
  } else if (loading) {
    buttonText = "Checking enrollment...";
    description = "Loading your enrollment information.";
  } else if (sessionExpired) {
    buttonText = "Sign-in required";
    description = "Please sign in again to continue.";
  } else if (status === "ACTIVE") {
    buttonText = "Enrolled";
    description =
      "You are enrolled in this course. Choose a lesson or practice from the syllabus to begin.";
  } else if (status === "COMPLETED") {
    buttonText = "Course completed";
    description = "You have completed this course.";
  } else if (status === "LEFT") {
    buttonText = "Previously enrolled";
    description = "Contact the course instructor if you want to rejoin.";
  } else if (!enrollmentOpen) {
    buttonText = "Enrollment closed";
    description = "This course is not accepting new enrollments.";
  } else if (submitting) {
    buttonText = "Enrolling...";
    description = "Please wait while your enrollment is saved.";
  }

  const disabled =
    !accessToken ||
    loading ||
    submitting ||
    sessionExpired ||
    !enrollmentOpen ||
    status !== null ||
    Boolean(error);

  return (
    <div className="mt-6 border-t border-slate-100 pt-5">
      {!accessToken || sessionExpired ? (
        <Link
          to="/login"
          state={{ from: `/courses/${encodeURIComponent(courseId)}` }}
          className="inline-flex rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Sign in to enroll
        </Link>
      ) : (
        status !== "ACTIVE" &&
        status !== "COMPLETED" && (
          <button
            type="button"
            onClick={() => void handleEnroll()}
            disabled={disabled}
            aria-busy={loading || submitting}
            className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {buttonText}
          </button>
        )
      )}

      <div
        role="status"
        className={
          "mt-4 flex items-start gap-3 rounded-lg border p-3 text-sm leading-6 " +
          (status === "ACTIVE" || status === "COMPLETED"
            ? "border-emerald-100 bg-emerald-50 text-emerald-800"
            : "border-slate-200 bg-slate-50 text-slate-600")
        }
      >
        <span
          aria-hidden="true"
          className={
            "mt-2 h-2 w-2 shrink-0 rounded-full " +
            (status === "ACTIVE" || status === "COMPLETED"
              ? "bg-emerald-500"
              : "bg-blue-500")
          }
        />

        <p>{description}</p>
      </div>

      {status === "ACTIVE" &&
        session?.user.roles.includes("LEARNER") &&
        !sessionExpired && (
          <button
            type="button"
            disabled={loading || checkingCompletion}
            onClick={() => void handleCompletion()}
            className="mt-4 rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50"
          >
            {checkingCompletion
              ? "Checking completion..."
              : "Check course completion"}
          </button>
        )}
      {completionMessage && (
        <p role="status" className="mt-3 text-sm leading-6 text-slate-600">
          {completionMessage}
        </p>
      )}

      {status !== "ACTIVE" && status !== "COMPLETED" && (
        <p className="mt-3 text-xs leading-5 text-slate-500">
          You can preview the syllabus before joining this course.
        </p>
      )}

      {error && (
        <div className="mt-3">
          <p role="alert" className="text-sm leading-6 text-red-700">
            {error}
          </p>

          {!sessionExpired && (
            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
              className="mt-2 text-sm font-semibold text-blue-600 hover:underline"
            >
              Check enrollment again
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function CourseEnrollmentPanel(
  props: CourseEnrollmentPanelProps,
) {
  return (
    <EnrollmentPanel
      key={JSON.stringify([props.courseId, props.accessToken])}
      {...props}
    />
  );
}

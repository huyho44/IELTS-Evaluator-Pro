import { useEffect, useRef, useState } from "react";
import {
    EnrollmentApiError,
    enrollInCourse,
    getMyEnrollments,
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
    const [status, setStatus] = useState<EnrollmentStatus | null>(null);
    const [loading, setLoading] = useState(Boolean(accessToken));
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [sessionExpired, setSessionExpired] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const mounted = useRef(false);

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
        description = "You are enrolled in this course.";
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
            <button
                type="button"
                onClick={() => void handleEnroll()}
                disabled={disabled}
                aria-busy={loading || submitting}
                className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {buttonText}
            </button>

            <p
                role="status"
                className="mt-3 text-sm leading-6 text-slate-500"
            >
                {description}
            </p>

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
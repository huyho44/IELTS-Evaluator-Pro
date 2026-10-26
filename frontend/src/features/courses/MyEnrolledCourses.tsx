import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    getMyEnrollments,
    type MyEnrollment,
} from "./enrollmentsApi";

type MyEnrolledCoursesProps = {
    accessToken: string | null;
};

function EnrolledCoursesContent({
    accessToken,
}: MyEnrolledCoursesProps) {
    const [enrollments, setEnrollments] = useState<MyEnrollment[]>([]);
    const [loading, setLoading] = useState(Boolean(accessToken));
    const [error, setError] = useState("");
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        if (!accessToken) {
            return;
        }

        const token = accessToken;
        const controller = new AbortController();

        async function loadCourses() {
            setLoading(true);
            setError("");

            try {
                const data = await getMyEnrollments(token, controller.signal);

                if (!controller.signal.aborted) {
                    setEnrollments(
                        data.filter(
                            (item) =>
                                item.status === "ACTIVE" ||
                                item.status === "COMPLETED",
                        ),
                    );
                }
            } catch (cause) {
                if (!controller.signal.aborted) {
                    setError(
                        cause instanceof Error
                            ? cause.message
                            : "Unable to load your enrolled courses.",
                    );
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        void loadCourses();

        return () => controller.abort();
    }, [accessToken, reloadKey]);

    return (
        <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8">
            <h1 className="text-2xl font-bold text-slate-900">
                My Enrolled Courses
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-600">
                Your active and completed courses.
            </p>

            {!accessToken ? (
                <div className="mt-6 rounded-xl border border-slate-200 bg-white p-8">
                    <p className="text-slate-600">
                        Please sign in to view your enrolled courses.
                    </p>
                </div>
            ) : loading ? (
                <div
                    role="status"
                    className="mt-6 rounded-xl border border-slate-200 bg-white p-8 text-slate-500"
                >
                    Loading your courses...
                </div>
            ) : error ? (
                <div className="mt-6 rounded-xl border border-red-200 bg-white p-8">
                    <p role="alert" className="text-sm text-red-700">
                        {error}
                    </p>

                    <button
                        type="button"
                        onClick={() => setReloadKey((value) => value + 1)}
                        className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                        Try again
                    </button>
                </div>
            ) : enrollments.length === 0 ? (
                <div className="mt-6 rounded-xl border border-slate-200 bg-white p-8">
                    <h2 className="text-lg font-semibold">
                        No enrolled courses yet
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                        Enroll in a course to see it here.
                    </p>

                    <Link
                        to="/courses"
                        className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:underline"
                    >
                        Browse courses
                    </Link>
                </div>
            ) : (
                <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {enrollments.map((enrollment) => (
                        <article
                            key={enrollment.id}
                            className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                        >
                            <span className="self-start rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                                {enrollment.status === "COMPLETED"
                                    ? "Completed"
                                    : "Enrolled"}
                            </span>

                            <h2 className="mt-3 break-words text-xl font-bold leading-snug">
                                {enrollment.course.title}
                            </h2>

                            <p className="mt-3 break-words text-sm leading-6 text-slate-600">
                                {enrollment.course.description ||
                                    "No description available yet."}
                            </p>

                            <div className="mt-auto pt-6">
                                <Link
                                    to={`/courses/${enrollment.courseId}`}
                                    className="block rounded-lg border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:border-blue-600 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                                >
                                    View Course
                                </Link>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </main>
    );
}

export default function MyEnrolledCourses(
    props: MyEnrolledCoursesProps,
) {
    return (
        <EnrolledCoursesContent
            key={props.accessToken ?? "signed-out"}
            {...props}
        />
    );
}
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Spinner from "../../components/ui/Spinner";
import DiscussionBoard from "./DiscussionBoard";
import {
  discussionError,
  discussionsApi,
  type StaffCourse,
} from "./discussionsApi";

// Instructor and admin view of course discussions. The selected course and
// thread live in the URL (?course=&thread=) so notifications can deep-link.
export default function StaffDiscussionsPage() {
  const [params, setParams] = useSearchParams();
  const [courses, setCourses] = useState<StaffCourse[] | null>(null);
  const [error, setError] = useState("");
  const courseId = params.get("course");
  const threadId = params.get("thread");

  useEffect(() => {
    let active = true;
    discussionsApi
      .staffCourses()
      .then((result) => {
        if (active) setCourses(result);
      })
      .catch((cause) => {
        if (active) setError(discussionError(cause, "Unable to load courses."));
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedCourse =
    courses?.find((course) => course.id === courseId) ??
    (courses?.length === 1 ? courses[0] : undefined);

  const selectThread = useCallback(
    (id: string | null) => {
      setParams((current) => {
        const next = new URLSearchParams(current);
        if (selectedCourse) next.set("course", selectedCourse.id);
        if (id) next.set("thread", id);
        else next.delete("thread");
        return next;
      });
    },
    [selectedCourse, setParams],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <header>
        <p className="ui-eyebrow">Course community</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Discussions</h1>
        <p className="mt-1 text-sm text-slate-500">
          Answer learner questions and lock threads that are resolved or off-topic.
        </p>
      </header>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : !courses ? (
        <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner className="h-4 w-4 text-brand-600" /> Loading courses...
        </p>
      ) : courses.length === 0 ? (
        <p className="text-sm text-slate-600">
          You are not assigned to any course yet.
        </p>
      ) : (
        <>
          <div className="max-w-md">
            <label htmlFor="discussion-course" className="ui-label">
              Course
            </label>
            <select
              id="discussion-course"
              value={selectedCourse?.id ?? ""}
              onChange={(event) =>
                setParams(event.target.value ? { course: event.target.value } : {})
              }
              className="ui-input"
            >
              <option value="">Select a course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                  {course.status !== "PUBLISHED" ? ` (${course.status.toLowerCase()})` : ""}
                  {` · ${course.openThreads} open`}
                </option>
              ))}
            </select>
          </div>
          {selectedCourse ? (
            <DiscussionBoard
              key={selectedCourse.id}
              courseId={selectedCourse.id}
              heading={selectedCourse.title}
              description="All questions and discussion threads in this course."
              selectedThreadId={threadId}
              onSelectThread={selectThread}
              noAccessMessage="You are no longer assigned to this course."
            />
          ) : (
            <p className="text-sm text-slate-500">
              Choose a course to see its discussion.
            </p>
          )}
        </>
      )}
    </div>
  );
}

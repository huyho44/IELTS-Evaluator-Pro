import { useEffect, useState } from "react";
import {
  managementError,
  managementRequest as request,
} from "../managementApi";
import type { AuthoringProps } from "./authoringTypes";

type PublicCourse = { id: string; title: string };

// A5: learners must complete every prerequisite course before enrolling.
export default function PrerequisitesEditor({
  course,
  busy,
  run,
}: AuthoringProps) {
  const current = (course.prerequisites ?? []).map(
    (row) => row.prerequisiteCourseId,
  );
  const [selected, setSelected] = useState<string[]>(current);
  const [options, setOptions] = useState<PublicCourse[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    request<PublicCourse[]>("GET", "/courses")
      .then((rows) => {
        if (active) setOptions(rows.filter((row) => row.id !== course.id));
      })
      .catch((cause) => {
        if (active) setError(managementError(cause));
      });
    return () => {
      active = false;
    };
  }, [course.id]);

  const unchanged =
    selected.length === current.length &&
    selected.every((id) => current.includes(id));

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void run("PUT", `/courses/${course.id}/prerequisites`, {
          prerequisiteCourseIds: selected,
        });
      }}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs"
    >
      <div>
        <h2 className="text-base font-bold text-slate-900">
          Course prerequisites
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Learners must complete these published courses before they can
          enroll. Learners already enrolled are not affected. Cycles are
          rejected.
        </p>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {!options ? (
        <p className="text-sm text-slate-500">Loading courses...</p>
      ) : options.length === 0 ? (
        <p className="text-sm text-slate-500">
          No other published courses are available.
        </p>
      ) : (
        <fieldset className="max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-3">
          <legend className="sr-only">Prerequisite courses</legend>
          {options.map((option) => (
            <label
              key={option.id}
              className="flex items-center gap-2 text-sm text-slate-800"
            >
              <input
                type="checkbox"
                checked={selected.includes(option.id)}
                onChange={(event) =>
                  setSelected(
                    event.target.checked
                      ? [...selected, option.id]
                      : selected.filter((id) => id !== option.id),
                  )
                }
                className="size-4 rounded border-slate-300"
              />
              {option.title}
            </label>
          ))}
        </fieldset>
      )}
      <button
        type="submit"
        disabled={busy || unchanged || selected.length > 10}
        className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        Save prerequisites
      </button>
      {selected.length > 10 && (
        <p className="text-xs text-red-700">Choose at most 10 courses.</p>
      )}
    </form>
  );
}

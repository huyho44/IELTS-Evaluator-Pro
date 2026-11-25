import { useState } from "react";
import { field } from "../managementApi";
import {
  STATUS_BADGES,
  changedFields,
  type AuthoringProps,
  type CourseRow,
} from "./authoringTypes";

type Section = CourseRow["chapters"][number];
type Item = CourseRow["learningItems"][number];

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGES[status] ?? STATUS_BADGES.HIDDEN}`}
    >
      {status}
    </span>
  );
}

// A8: edit titles, order and lesson text; hide or show sections and items.
// Hidden content disappears for learners but attempts and evidence are kept.
export default function ContentEditor({ course, busy, run }: AuthoringProps) {
  const sections = [...course.chapters].sort((a, b) => a.position - b.position);
  const items = [...course.learningItems].sort(
    (a, b) => a.position - b.position,
  );
  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
      <div>
        <h2 className="text-base font-bold text-slate-900">
          Edit and hide content
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Hidden sections and items are removed from the learner view. Past
          attempts, grades and skill evidence are kept. Hiding a section hides
          everything inside it.
        </p>
      </div>
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Sections
        </h3>
        {sections.length ? (
          sections.map((section) => (
            <SectionRow
              key={`${section.id}:${section.title}:${section.position}:${section.status}`}
              courseId={course.id}
              section={section}
              busy={busy}
              run={run}
            />
          ))
        ) : (
          <p className="text-xs text-slate-500">No sections yet.</p>
        )}
      </div>
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Lessons and practices
        </h3>
        {items.length ? (
          items.map((item) => (
            <ItemRow
              key={`${item.id}:${item.title}:${item.position}:${item.status}:${item.chapterId}`}
              courseId={course.id}
              item={item}
              sections={sections}
              busy={busy}
              run={run}
            />
          ))
        ) : (
          <p className="text-xs text-slate-500">No learning items yet.</p>
        )}
      </div>
    </section>
  );
}

function SectionRow({
  courseId,
  section,
  busy,
  run,
}: {
  courseId: string;
  section: Section;
  busy: boolean;
  run: AuthoringProps["run"];
}) {
  const [title, setTitle] = useState(section.title);
  const [position, setPosition] = useState(section.position);
  const path = `/courses/${courseId}/sections/${section.id}`;
  const changes = changedFields(
    { title: section.title, position: section.position },
    { title: title.trim(), position },
  );
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (Object.keys(changes).length) void run("PATCH", path, changes);
      }}
      className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 p-3"
    >
      <label className="min-w-40 flex-1 text-xs font-medium text-slate-700">
        Title
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          maxLength={240}
          className={`${field} mt-1`}
        />
      </label>
      <label className="w-20 text-xs font-medium text-slate-700">
        Order
        <input
          type="number"
          min={1}
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          className={`${field} mt-1`}
        />
      </label>
      <StatusBadge status={section.status} />
      <button
        type="submit"
        disabled={busy || !Object.keys(changes).length}
        className="rounded-lg bg-brand-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
      >
        Save
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void run("PATCH", path, {
            status: section.status === "PUBLISHED" ? "HIDDEN" : "PUBLISHED",
          })
        }
        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
      >
        {section.status === "PUBLISHED" ? "Hide" : "Show"}
      </button>
    </form>
  );
}

function ItemRow({
  courseId,
  item,
  sections,
  busy,
  run,
}: {
  courseId: string;
  item: Item;
  sections: Section[];
  busy: boolean;
  run: AuthoringProps["run"];
}) {
  const textMaterial = item.lesson?.lessonMaterials.find(
    (material) => material.kind === "TEXT",
  );
  const initial = {
    title: item.title,
    position: item.position,
    sectionId: item.chapterId,
    summary: item.lesson?.summary ?? "",
    contentText: textMaterial?.contentText ?? "",
  };
  const [draft, setDraft] = useState(initial);
  const [open, setOpen] = useState(false);
  const path = `/courses/${courseId}/items/${item.id}`;
  const changes = changedFields(initial, {
    ...draft,
    title: draft.title.trim(),
  });
  const section = sections.find((row) => row.id === item.chapterId);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (Object.keys(changes).length) void run("PATCH", path, changes);
      }}
      className="space-y-2 rounded-xl border border-slate-200 p-3"
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-40 flex-1 text-xs font-medium text-slate-700">
          {item.kind === "LESSON"
            ? "Lesson title"
            : `${item.practiceActivity?.skillArea ?? "Practice"} title`}
          <input
            value={draft.title}
            onChange={(event) =>
              setDraft({ ...draft, title: event.target.value })
            }
            required
            maxLength={240}
            className={`${field} mt-1`}
          />
        </label>
        <label className="w-20 text-xs font-medium text-slate-700">
          Order
          <input
            type="number"
            min={1}
            value={draft.position}
            onChange={(event) =>
              setDraft({ ...draft, position: Number(event.target.value) })
            }
            className={`${field} mt-1`}
          />
        </label>
        <label className="w-44 text-xs font-medium text-slate-700">
          Section
          <select
            value={draft.sectionId ?? ""}
            onChange={(event) =>
              setDraft({ ...draft, sectionId: event.target.value || null })
            }
            className={`${field} mt-1`}
          >
            <option value="">No section</option>
            {sections.map((row) => (
              <option key={row.id} value={row.id}>
                {row.title}
              </option>
            ))}
          </select>
        </label>
        <StatusBadge status={item.status} />
        {section && section.status !== "PUBLISHED" && (
          <span className="text-[11px] font-semibold text-slate-500">
            (section hidden)
          </span>
        )}
      </div>
      {item.kind === "LESSON" && (
        <div>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="text-xs font-semibold text-brand-700 hover:underline"
          >
            {open ? "Hide lesson text" : "Edit lesson text"}
          </button>
          {open && (
            <div className="mt-2 space-y-2">
              <label className="block text-xs font-medium text-slate-700">
                Summary
                <input
                  value={draft.summary}
                  onChange={(event) =>
                    setDraft({ ...draft, summary: event.target.value })
                  }
                  className={`${field} mt-1`}
                />
              </label>
              <label className="block text-xs font-medium text-slate-700">
                Lesson content
                <textarea
                  rows={6}
                  value={draft.contentText}
                  onChange={(event) =>
                    setDraft({ ...draft, contentText: event.target.value })
                  }
                  required
                  className={`${field} mt-1`}
                />
              </label>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy || !Object.keys(changes).length}
          className="rounded-lg bg-brand-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
        >
          Save changes
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run("PATCH", path, {
              status: item.status === "PUBLISHED" ? "HIDDEN" : "PUBLISHED",
            })
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          {item.status === "PUBLISHED" ? "Hide from learners" : "Publish"}
        </button>
      </div>
    </form>
  );
}

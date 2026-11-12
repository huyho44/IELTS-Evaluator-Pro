import { useEffect, useRef, useState } from "react";

import { useSession } from "../auth/session";
import ObjectiveAuthoring from "./ObjectiveAuthoring";
import ActionForm from "./ActionForm";
import {
  managementRequest as request,
  managementError,
  field,
  panel,
  type Catalog,
} from "./managementApi";

type Template = {
  instructions: string;
  schema: unknown;
  criteria: { code: string; name: string; definition: string }[];
};
export default function AuthoringPage({
  adminAssessment = false,
}: {
  adminAssessment?: boolean;
}) {
  const { session } = useSession();
  return <Content adminAssessment={adminAssessment} key={session?.user.id} />;
}
function Content({ adminAssessment }: { adminAssessment: boolean }) {
  const { session } = useSession();
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [template, setTemplate] = useState<Template | null>(null),
    [courseId, setCourseId] = useState("");
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0);
  const [view, setView] = useState(""),
    [sectionId, setSectionId] = useState(""),
    [offer, setOffer] = useState("");
  const [newRubric, setNewRubric] = useState("");
  const open = (next: string, section = "") => {
    setView(next);
    setSectionId(section);
    setError("");
    setMessage("");
    setOffer("");
    setNewRubric("");
  };
  const activityPublished = (id: string) => {
    setVersionId(id);
    setOffer(id);
    setView("");
    setMessage("Activity published.");
    setRefresh((v) => v + 1);
  };
  const editor = useRef<HTMLElement>(null);
  useEffect(() => {
    if (view && window.matchMedia("(max-width:1023px)").matches)
      editor.current?.scrollIntoView({ block: "start" });
  }, [view]);
  const action = useRef(false);
  const [area, setArea] = useState("WRITING");
  const [versionId, setVersionId] = useState("");
  const [rubricType, setRubricType] = useState("WRITING_TASK_2");
  const speakingCriteria = [
    {
      code: "FC",
      name: "Fluency and coherence",
      definition: "Maintains clear, connected speech.",
    },
    {
      code: "LR",
      name: "Lexical resource",
      definition: "Uses vocabulary accurately and appropriately.",
    },
    {
      code: "GRA",
      name: "Grammatical range and accuracy",
      definition: "Uses varied and accurate grammatical structures.",
    },
    {
      code: "PR",
      name: "Pronunciation",
      definition: "Produces intelligible speech.",
    },
  ];
  useEffect(() => {
    let active = true;
    Promise.all([
      request<Catalog>("GET", "/authoring/catalog"),
      request<Template>("GET", "/grading/templates/writing-task-2"),
    ])
      .then(([data, t]) => {
        if (active) {
          setCatalog(data);
          setTemplate(t);
          setCourseId((previous) => previous || data.courses[0]?.id || "");
        }
      })
      .catch((cause) => {
        if (active) setError(managementError(cause));
      });
    return () => {
      active = false;
    };
  }, [refresh]);
  async function run(method: "POST" | "PATCH", path: string, body: unknown) {
    if (action.current) return false;
    action.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await request<{
        id: string;
        practiceActivity?: { activityVersions: { id: string }[] };
      }>(method, path, body);
      setMessage(
        "Saved. Published versions already used by attempts were preserved.",
      );
      if (path === "/courses") setCourseId(result.id);
      if (result.practiceActivity)
        activityPublished(result.practiceActivity.activityVersions[0].id);
      else if (path === "/grading/rubrics") {
        setNewRubric(result.id);
        setView("assign");
      } else if (!path.endsWith("/order")) setView("");
      setRefresh((v) => v + 1);
      return true;
    } catch (cause) {
      setError(managementError(cause));
      return false;
    } finally {
      action.current = false;
      setBusy(false);
    }
  }
  const selected = catalog?.courses.find((c) => c.id === courseId);
  const assignmentArea = selected?.learningItems.find((i) =>
    i.practiceActivity?.activityVersions.some((v) => v.id === versionId),
  )?.practiceActivity?.skillArea;
  const needsRubric =
    assignmentArea === "WRITING" || assignmentArea === "SPEAKING";
  const instructor = session?.user.roles.includes("INSTRUCTOR");
  const canEditCourse =
    !!instructor &&
    !!selected?.courseInstructors.some(
      (item) => item.instructorId === session?.user.id,
    );
  const iso = (value: FormDataEntryValue | null) =>
    typeof value === "string" && value
      ? new Date(value).toISOString()
      : undefined;
  const nextPosition =
    Math.max(0, ...(selected?.learningItems.map((i) => i.position) ?? [])) + 1;
  const activeItem = selected?.learningItems.find((i) =>
    i.practiceActivity?.activityVersions.some((v) => v.id === versionId),
  );
  const sectionPicker = (
    <label className="block">
      Section
      <select
        className={field}
        value={sectionId}
        onChange={(e) => setSectionId(e.target.value)}
      >
        <option value="">No section</option>
        {selected?.chapters.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
    </label>
  );
  const link = "text-sm font-semibold text-blue-700";
  const groups = selected
    ? [...selected.chapters, { id: "", title: "No section" }]
    : [];
  return (
    <main className="mx-auto max-w-6xl space-y-5 p-5">
      <h1 className="text-2xl font-bold">
        {adminAssessment ? "AI assessment" : "Course authoring"}
      </h1>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status">
          {message}{" "}
          {offer && (
            <button
              className={link}
              onClick={() => {
                open("assign");
                setVersionId(offer);
              }}
            >
              Assign now
            </button>
          )}
        </p>
      )}
      {adminAssessment ? (
        <>
          {" "}
          {session?.user.roles.includes("ADMIN") && template && (
            <ActionForm
              title="Configure AI assessment"
              busy={busy}
              submit={(data) =>
                run("POST", "/grading/configs", {
                  rubricVersionId: data.get("rubricId"),
                  provider: data.get("provider"),
                  modelId: data.get("model"),
                  promptCode: data.get("promptCode"),
                  promptVersionNo: Number(data.get("version")),
                  instructions: data.get("instructions"),
                  outputSchemaJson: template.schema,
                  settingsJson: { max_output_tokens: 4000 },
                })
              }
            >
              <p className="text-sm text-slate-600">
                API keys are configured on the server. Choose a model enabled in
                your provider account.
              </p>
              <label className="block text-sm">
                Writing rubric
                <select required name="rubricId" className={field}>
                  <option value="">Choose rubric</option>
                  {catalog?.rubrics
                    .filter((r) => r.taskType.startsWith("WRITING"))
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.rubricCode} v{r.versionNo}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block text-sm">
                Provider
                <select name="provider" className={field}>
                  <option value="OPENAI">OpenAI Responses</option>
                  <option value="JSON_HTTP">Custom JSON gateway</option>
                </select>
              </label>
              <label className="block text-sm">
                Model ID
                <input
                  required
                  name="model"
                  maxLength={120}
                  className={field}
                />
              </label>
              <label className="block text-sm">
                Prompt code
                <input
                  required
                  name="promptCode"
                  maxLength={60}
                  className={field}
                />
              </label>
              <label className="block text-sm">
                Prompt version
                <input
                  required
                  name="version"
                  type="number"
                  min={1}
                  defaultValue={1}
                  className={field}
                />
              </label>
              <label className="block text-sm">
                Assessment instructions
                <textarea
                  required
                  rows={8}
                  name="instructions"
                  defaultValue={template.instructions}
                  className={field}
                />
              </label>
            </ActionForm>
          )}
          {!!catalog?.gradingConfigs.length && (
            <section className={panel}>
              <h2 className="text-lg font-bold">Assessment configurations</h2>
              {catalog.gradingConfigs.map((c) => (
                <p key={c.id} className="text-sm">
                  {c.provider} · {c.modelId} ·{" "}
                  {catalog.rubrics.find((r) => r.id === c.rubricVersionId)
                    ?.rubricCode ?? "Rubric"}
                </p>
              ))}
            </section>
          )}
        </>
      ) : (
        <>
          <header className="flex flex-wrap items-end gap-4">
            <label className="min-w-64">
              Course
              <select
                className={field}
                value={courseId}
                onChange={(e) => {
                  if (e.target.value === "create") {
                    open("course");
                    return;
                  }
                  setCourseId(e.target.value);
                  open("");
                }}
              >
                <option value="">Choose course</option>
                {catalog?.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
                {instructor && <option value="create">+ Create course</option>}
              </select>
            </label>
            {canEditCourse && (
              <button className={link} onClick={() => open("settings")}>
                Course settings
              </button>
            )}
          </header>
          <div
            className={
              view
                ? "grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(380px,1fr)]"
                : ""
            }
          >
            {selected && (
              <section className={panel}>
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-bold">Course content</h2>
                  {canEditCourse && (
                    <button className={link} onClick={() => open("add")}>
                      + Add content
                    </button>
                  )}
                </div>
                {groups.map((g) => {
                  const items = selected.learningItems.filter(
                    (i) => (i.chapterId ?? "") === g.id,
                  );
                  if (!g.id && !items.length) return null;
                  return (
                    <details open key={g.id} className="border-t py-2">
                      <summary className="cursor-pointer font-semibold">
                        {g.title}
                      </summary>
                      {canEditCourse && g.id && (
                        <button
                          className={link}
                          onClick={() => open("add", g.id)}
                        >
                          + Add to section
                        </button>
                      )}
                      {items.map((i, index) => (
                        <div
                          key={i.id}
                          className="flex flex-wrap items-center gap-3 border-t py-2"
                        >
                          <div className="min-w-32 flex-1">
                            <p>{i.title}</p>
                            <small>
                              {i.practiceActivity?.skillArea.toLowerCase() ??
                                "Lesson"}
                            </small>
                          </div>
                          {canEditCourse && (
                            <>
                              {items.length > 1 &&
                                (["up", "down"] as const).map((d) => (
                                  <button
                                    key={d}
                                    disabled={
                                      busy ||
                                      (d === "up"
                                        ? index === 0
                                        : index === items.length - 1)
                                    }
                                    aria-label={"Move " + i.title + " " + d}
                                    className="disabled:opacity-25"
                                    onClick={() =>
                                      run(
                                        "PATCH",
                                        "/courses/" +
                                          courseId +
                                          "/content/" +
                                          i.id +
                                          "/order",
                                        { direction: d },
                                      )
                                    }
                                  >
                                    {d === "up" ? "↑" : "↓"}
                                  </button>
                                ))}
                              {i.practiceActivity?.activityVersions[0] && (
                                <button
                                  className={link}
                                  onClick={() => {
                                    open("assign");
                                    setVersionId(
                                      i.practiceActivity!.activityVersions[0]
                                        .id,
                                    );
                                  }}
                                >
                                  Assign
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </details>
                  );
                })}
                {!selected.learningItems.length &&
                  !selected.chapters.length && <p>No content yet.</p>}
                {selected.assignments.length > 0 && (
                  <details>
                    <summary className="cursor-pointer">
                      Assignments ({selected.assignments.length})
                    </summary>
                    {selected.assignments.map((a) => (
                      <p key={a.id}>
                        {a.title} · v{a.assignmentVersions[0]?.versionNo}
                      </p>
                    ))}
                  </details>
                )}
              </section>
            )}
            {view && (
              <aside
                ref={editor}
                key={
                  courseId +
                  ":" +
                  (view === "rubric" ? "assign" : view) +
                  (view === "assign" || view === "rubric" ? activeItem?.id : "")
                }
                className="space-y-4 rounded-xl border bg-white p-4 lg:sticky lg:top-3 lg:max-h-[95vh] lg:overflow-y-auto"
              >
                <div className="flex justify-end">
                  <button
                    className={link}
                    onClick={() =>
                      view === "rubric" ? setView("assign") : open("")
                    }
                  >
                    {view === "rubric" ? "Back to assignment" : "Close"}
                  </button>
                </div>
                {view === "add" && (
                  <>
                    <h2 className="font-bold">What would you like to add?</h2>
                    <div className="flex gap-4">
                      {(sectionId
                        ? ["Lesson", "Activity"]
                        : ["Section", "Lesson", "Activity"]
                      ).map((v) => (
                        <button
                          key={v}
                          className={link}
                          onClick={() => setView(v.toLowerCase())}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {view === "course" && instructor && (
                  <ActionForm
                    title="Create a course"
                    busy={busy}
                    submit={(data) =>
                      run("POST", "/courses", {
                        title: data.get("title"),
                        description: data.get("description"),
                        completionPolicyJson: { mode: "ALL_REQUIRED_ITEMS" },
                      })
                    }
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-sm">
                        Course title
                        <input
                          required
                          name="title"
                          maxLength={240}
                          className={field}
                        />
                      </label>
                      <label className="text-sm">
                        Description
                        <textarea
                          required
                          name="description"
                          className={field}
                        />
                      </label>
                    </div>
                  </ActionForm>
                )}
                {selected && canEditCourse && (
                  <>
                    {view === "settings" && (
                      <ActionForm
                        key={`${selected.id}:${selected.status}:${selected.enrollmentOpen}`}
                        title="Course settings"
                        busy={busy}
                        submit={(data) =>
                          run("PATCH", `/courses/${selected.id}`, {
                            title: data.get("title"),
                            description: data.get("description"),
                            status: data.get("status"),
                            enrollmentOpen: data.get("enrollmentOpen") === "on",
                          })
                        }
                      >
                        <label className="block text-sm">
                          Title
                          <input
                            required
                            name="title"
                            defaultValue={selected.title}
                            className={field}
                          />
                        </label>
                        <label className="block text-sm">
                          Description
                          <textarea
                            required
                            name="description"
                            defaultValue={selected.description}
                            className={field}
                          />
                        </label>
                        <label className="block text-sm">
                          Visibility
                          <select
                            name="status"
                            defaultValue={selected.status}
                            className={field}
                          >
                            {["DRAFT", "PUBLISHED", "HIDDEN", "ARCHIVED"].map(
                              (s) => (
                                <option key={s}>{s}</option>
                              ),
                            )}
                          </select>
                        </label>
                        <label className="flex gap-2 text-sm">
                          <input
                            type="checkbox"
                            name="enrollmentOpen"
                            defaultChecked={selected.enrollmentOpen}
                          />
                          Open enrollment
                        </label>
                        <p className="text-xs text-slate-500">
                          Instructors:{" "}
                          {selected.courseInstructors
                            .map(
                              (i) =>
                                `${i.instructor.displayName} (${i.responsibility})`,
                            )
                            .join(", ")}
                        </p>
                      </ActionForm>
                    )}
                    {view === "section" && (
                      <ActionForm
                        title="Add a section"
                        busy={busy}
                        submit={(data) =>
                          run("POST", `/courses/${courseId}/sections`, {
                            title: data.get("title"),
                            position:
                              Math.max(
                                0,
                                ...selected.chapters.map((c) => c.position),
                              ) + 1,
                          })
                        }
                      >
                        <label className="block text-sm">
                          Title
                          <input required name="title" className={field} />
                        </label>
                      </ActionForm>
                    )}
                    {view === "lesson" && (
                      <ActionForm
                        title="Add a text lesson"
                        busy={busy}
                        submit={(data) =>
                          run("POST", `/courses/${courseId}/lessons`, {
                            title: data.get("title"),
                            contentText: data.get("contentText"),
                            position: nextPosition,
                            sectionId: sectionId || null,
                          })
                        }
                      >
                        <label className="block text-sm">
                          Title
                          <input required name="title" className={field} />
                        </label>
                        {sectionPicker}
                        <label className="block text-sm">
                          Lesson content
                          <textarea
                            required
                            rows={5}
                            name="contentText"
                            className={field}
                          />
                        </label>
                      </ActionForm>
                    )}
                    {view === "activity" && (
                      <>
                        <label className="block">
                          Activity type
                          <select
                            value={area}
                            className={field}
                            onChange={(e) => setArea(e.target.value)}
                          >
                            {[
                              "READING",
                              "LISTENING",
                              "WRITING",
                              "SPEAKING",
                            ].map((v) => (
                              <option key={v} value={v}>
                                {v[0] + v.slice(1).toLowerCase()}
                              </option>
                            ))}
                          </select>
                        </label>
                        {sectionPicker}
                        {area === "READING" || area === "LISTENING" ? (
                          <ObjectiveAuthoring
                            courseId={courseId}
                            area={area}
                            sectionId={sectionId}
                            position={nextPosition}
                            published={activityPublished}
                          />
                        ) : (
                          <ActionForm
                            title="Publish activity"
                            busy={busy}
                            submit={(data) =>
                              run("POST", `/courses/${courseId}/activities`, {
                                title: data.get("title"),
                                position: nextPosition,
                                sectionId: sectionId || null,
                                skillArea: area,
                                promptText: data.get("prompt"),
                                instructions: data.get("instructions"),
                                difficulty: Number(data.get("difficulty")),
                                expectedMinutes: Number(data.get("minutes")),
                                skillIds:
                                  area === "SPEAKING" &&
                                  !data.getAll("skills").length
                                    ? undefined
                                    : data.getAll("skills"),
                              })
                            }
                          >
                            <label className="block text-sm">
                              Title
                              <input required name="title" className={field} />
                            </label>
                            <label className="block">
                              {" "}
                              Task prompt
                              <textarea
                                required
                                rows={4}
                                name="prompt"
                                className={field}
                              />
                            </label>
                            <label className="block text-sm">
                              Instructions
                              <textarea
                                required
                                rows={3}
                                name="instructions"
                                className={field}
                              />
                            </label>
                            <label className="block text-sm">
                              Target skills{" "}
                              {area === "SPEAKING"
                                ? "(optional)"
                                : "(select one or more)"}
                              <select
                                required={area === "WRITING"}
                                multiple
                                name="skills"
                                className={`${field} min-h-32`}
                              >
                                {catalog?.skills
                                  .filter(
                                    (s) =>
                                      s.skillArea === area &&
                                      s.status === "PUBLISHED",
                                  )
                                  .map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.name}
                                    </option>
                                  ))}
                              </select>
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                              <label className="text-sm">
                                Difficulty
                                <input
                                  required
                                  type="number"
                                  min={1}
                                  max={5}
                                  name="difficulty"
                                  defaultValue={2}
                                  className={field}
                                />
                              </label>
                              <label className="text-sm">
                                Minutes
                                <input
                                  required
                                  type="number"
                                  min={1}
                                  max={240}
                                  name="minutes"
                                  defaultValue={40}
                                  className={field}
                                />
                              </label>
                            </div>
                          </ActionForm>
                        )}
                      </>
                    )}
                    {(view === "assign" || view === "rubric") && (
                      <div hidden={view === "rubric"}>
                        <ActionForm
                          title="Publish an assignment or new version"
                          busy={busy}
                          submit={(data) => {
                            const mode = String(data.get("releaseMode"));
                            return run(
                              "POST",
                              `/courses/${courseId}/assignments${data.get("assignmentId") ? `/${data.get("assignmentId")}/versions` : ""}`,
                              {
                                title: data.get("title"),
                                activityVersionId:
                                  data.get("activityVersionId"),
                                rubricVersionId: needsRubric
                                  ? data.get("rubricId")
                                  : null,
                                mode: data.get("mode"),
                                maxAttempts: Number(data.get("attempts")),
                                maxRevisions: Number(data.get("revisions")),
                                opensAt: iso(data.get("opensAt")),
                                dueAt: iso(data.get("dueAt")),
                                allowLate: data.get("allowLate") === "on",
                                ...(data.get("seconds")
                                  ? {
                                      timeLimitSeconds: Number(
                                        data.get("seconds"),
                                      ),
                                    }
                                  : {}),
                                releasePolicyJson: {
                                  releaseMode: mode,
                                  ...(mode === "SCHEDULED"
                                    ? { releaseAt: iso(data.get("releaseAt")) }
                                    : {}),
                                },
                              },
                            );
                          }}
                        >
                          <label className="block text-sm">
                            Create or update
                            <select name="assignmentId" className={field}>
                              <option value="">New assignment</option>
                              {selected.assignments
                                .filter((a) => a.activityId === activeItem?.id)
                                .map((a) => (
                                  <option key={a.id} value={a.id}>
                                    New version of: {a.title}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <label className="block text-sm">
                            Assignment title
                            <input
                              required
                              defaultValue={activeItem?.title}
                              name="title"
                              className={field}
                            />
                          </label>
                          <input
                            type="hidden"
                            name="activityVersionId"
                            value={versionId}
                          />
                          {needsRubric && (
                            <>
                              {" "}
                              <label className="block text-sm">
                                Rubric
                                <select
                                  defaultValue={newRubric}
                                  key={
                                    assignmentArea +
                                    newRubric +
                                    Boolean(
                                      catalog?.rubrics.some(
                                        (r) => r.id === newRubric,
                                      ),
                                    )
                                  }
                                  required={needsRubric}
                                  disabled={!needsRubric}
                                  name="rubricId"
                                  className={field}
                                >
                                  <option value="">
                                    {needsRubric
                                      ? "Choose rubric"
                                      : "Objective activities use an answer key"}
                                  </option>
                                  {catalog?.rubrics
                                    .filter(
                                      (r) =>
                                        !!assignmentArea &&
                                        r.taskType.startsWith(assignmentArea),
                                    )
                                    .map((r) => (
                                      <option key={r.id} value={r.id}>
                                        {r.rubricCode} v{r.versionNo}
                                      </option>
                                    ))}
                                </select>
                              </label>
                              <button
                                className={link}
                                type="button"
                                onClick={() => {
                                  setRubricType(
                                    assignmentArea === "SPEAKING"
                                      ? "SPEAKING"
                                      : "WRITING_TASK_2",
                                  );
                                  setView("rubric");
                                }}
                              >
                                + Create rubric
                              </button>
                            </>
                          )}
                          <label className="block text-sm">
                            Assessment mode
                            <select name="mode" className={field}>
                              <option value="PRACTICE">
                                Practice: provisional AI feedback allowed by
                                release policy
                              </option>
                              <option value="GRADED">
                                Graded: instructor confirmation required
                              </option>
                            </select>
                          </label>
                          <label className="text-sm">
                            Due at
                            <input
                              name="dueAt"
                              type="datetime-local"
                              className={field}
                            />
                          </label>
                          <details>
                            <summary>Advanced settings</summary>
                            {activeItem &&
                              (activeItem.practiceActivity?.activityVersions
                                .length ?? 0) > 1 && (
                                <label>
                                  Activity version
                                  <select
                                    className={field}
                                    value={versionId}
                                    onChange={(e) =>
                                      setVersionId(e.target.value)
                                    }
                                  >
                                    {activeItem.practiceActivity?.activityVersions.map(
                                      (v) => (
                                        <option key={v.id} value={v.id}>
                                          v{v.versionNo}
                                        </option>
                                      ),
                                    )}
                                  </select>
                                </label>
                              )}{" "}
                            <div className="grid grid-cols-2 gap-3">
                              <label className="text-sm">
                                Maximum attempts
                                <input
                                  required
                                  name="attempts"
                                  type="number"
                                  min={1}
                                  defaultValue={5}
                                  className={field}
                                />
                              </label>
                              <label className="text-sm">
                                Revisions per attempt
                                <input
                                  required
                                  name="revisions"
                                  type="number"
                                  min={1}
                                  defaultValue={4}
                                  className={field}
                                />
                              </label>
                              <label className="text-sm">
                                Opens at
                                <input
                                  name="opensAt"
                                  type="datetime-local"
                                  className={field}
                                />
                              </label>
                            </div>{" "}
                            <label className="block text-sm">
                              Time limit in seconds (blank for none)
                              <input
                                name="seconds"
                                type="number"
                                min={60}
                                className={field}
                              />
                            </label>
                            <label className="flex gap-2 text-sm">
                              <input type="checkbox" name="allowLate" />
                              Allow late submissions
                            </label>
                            <label className="block text-sm">
                              Publication policy
                              <select name="releaseMode" className={field}>
                                {[
                                  "IMMEDIATE",
                                  "MANUAL",
                                  "AFTER_DUE_DATE",
                                  "SCHEDULED",
                                ].map((v) => (
                                  <option key={v}>{v}</option>
                                ))}
                              </select>
                            </label>
                            <label className="block text-sm">
                              Scheduled publication time
                              <input
                                name="releaseAt"
                                type="datetime-local"
                                className={field}
                              />
                            </label>
                          </details>
                        </ActionForm>
                      </div>
                    )}
                    {view === "rubric" && template && (
                      <ActionForm
                        title="Publish a scoring rubric"
                        busy={busy}
                        submit={(data) =>
                          run("POST", "/grading/rubrics", {
                            rubricCode: data.get("code"),
                            versionNo: Number(data.get("version")),
                            title: data.get("title"),
                            taskType: rubricType,
                            criteria: (rubricType === "SPEAKING"
                              ? speakingCriteria
                              : template.criteria
                            ).map((c) => ({
                              code: c.code,
                              name: c.name,
                              definition: data.get(c.code),
                            })),
                          })
                        }
                      >
                        <label className="block text-sm">
                          Rubric type
                          <select
                            disabled
                            value={rubricType}
                            className={field}
                            onChange={(e) => setRubricType(e.target.value)}
                          >
                            <option value="WRITING_TASK_2">
                              Writing Task 2
                            </option>
                            <option value="SPEAKING">Speaking</option>
                          </select>
                        </label>
                        <label className="block text-sm">
                          Rubric code
                          <input
                            required
                            name="code"
                            maxLength={60}
                            className={field}
                          />
                        </label>
                        <label className="block text-sm">
                          Title
                          <input required name="title" className={field} />
                        </label>
                        <label className="block text-sm">
                          Version
                          <input
                            required
                            type="number"
                            min={1}
                            name="version"
                            defaultValue={1}
                            className={field}
                          />
                        </label>
                        {(rubricType === "SPEAKING"
                          ? speakingCriteria
                          : template.criteria
                        ).map((c) => (
                          <label
                            key={rubricType + c.code}
                            className="block text-sm"
                          >
                            {c.name}
                            <textarea
                              required
                              name={c.code}
                              defaultValue={c.definition}
                              className={field}
                            />
                          </label>
                        ))}
                      </ActionForm>
                    )}
                  </>
                )}
              </aside>
            )}
          </div>
        </>
      )}
    </main>
  );
}

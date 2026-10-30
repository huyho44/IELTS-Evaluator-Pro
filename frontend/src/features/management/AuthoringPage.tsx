import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../auth/session";
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
export default function AuthoringPage() {
  const { session } = useSession();
  return <Content key={session?.user.id} />;
}
function Content() {
  const { session } = useSession();
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [template, setTemplate] = useState<Template | null>(null),
    [courseId, setCourseId] = useState("");
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0);
  const action = useRef(false);
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
      await request(method, path, body);
      setMessage(
        "Saved. Published versions already used by attempts were preserved.",
      );
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
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold">Course authoring</h1>
        <p className="text-sm text-slate-600">
          Create Writing lessons and activities, pin assessment versions and
          configure publication. Editing a published assignment creates a new
          version for future attempts.
        </p>
        <Link
          to="/teacher/reviews"
          className="text-sm font-semibold text-blue-600"
        >
          Open review queue
        </Link>
      </header>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-green-700">
          {message}
        </p>
      )}
      {instructor && (
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
              <input required name="title" maxLength={240} className={field} />
            </label>
            <label className="text-sm">
              Description
              <textarea required name="description" className={field} />
            </label>
          </div>
        </ActionForm>
      )}
      <label className="block text-sm font-semibold">
        Select course
        <select
          className={field}
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
        >
          <option value="">Choose a course</option>
          {catalog?.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} · {c.status}
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <>
          {canEditCourse && (
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
                  {["DRAFT", "PUBLISHED", "HIDDEN", "ARCHIVED"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
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
                    (i) => `${i.instructor.displayName} (${i.responsibility})`,
                  )
                  .join(", ")}
              </p>
            </ActionForm>
          )}
          {canEditCourse ? (
            <div
              key={selected.id}
              className="grid items-start gap-5 lg:grid-cols-2"
            >
              <ActionForm
                title="Add a section"
                busy={busy}
                submit={(data) =>
                  run("POST", `/courses/${courseId}/sections`, {
                    title: data.get("title"),
                    position: Number(data.get("position")),
                  })
                }
              >
                <label className="block text-sm">
                  Title
                  <input required name="title" className={field} />
                </label>
                <label className="block text-sm">
                  Position
                  <input
                    required
                    type="number"
                    min={1}
                    name="position"
                    defaultValue={selected.chapters.length + 1}
                    className={field}
                  />
                </label>
              </ActionForm>
              <ActionForm
                title="Add a text lesson"
                busy={busy}
                submit={(data) =>
                  run("POST", `/courses/${courseId}/lessons`, {
                    title: data.get("title"),
                    contentText: data.get("contentText"),
                    position: Number(data.get("position")),
                    ...(data.get("chapterId")
                      ? { sectionId: data.get("chapterId") }
                      : {}),
                  })
                }
              >
                <label className="block text-sm">
                  Title
                  <input required name="title" className={field} />
                </label>
                <label className="block text-sm">
                  Section
                  <select name="chapterId" className={field}>
                    <option value="">No section</option>
                    {selected.chapters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  Lesson content
                  <textarea
                    required
                    rows={5}
                    name="contentText"
                    className={field}
                  />
                </label>
                <label className="block text-sm">
                  Position
                  <input
                    required
                    type="number"
                    min={1}
                    name="position"
                    defaultValue={selected.learningItems.length + 1}
                    className={field}
                  />
                </label>
              </ActionForm>
              <ActionForm
                title="Publish a Writing activity"
                busy={busy}
                submit={(data) =>
                  run("POST", `/courses/${courseId}/activities`, {
                    title: data.get("title"),
                    position: Number(data.get("position")),
                    skillArea: "WRITING",
                    promptText: data.get("prompt"),
                    instructions: data.get("instructions"),
                    difficulty: Number(data.get("difficulty")),
                    expectedMinutes: Number(data.get("minutes")),
                    skillIds: data.getAll("skills"),
                  })
                }
              >
                <label className="block text-sm">
                  Title
                  <input required name="title" className={field} />
                </label>
                <label className="block text-sm">
                  Task prompt
                  <textarea required rows={4} name="prompt" className={field} />
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
                  Target skills (select one or more)
                  <select
                    required
                    multiple
                    name="skills"
                    className={`${field} min-h-32`}
                  >
                    {catalog?.skills
                      .filter((s) => s.skillArea === "WRITING")
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
                  <label className="text-sm">
                    Position
                    <input
                      required
                      type="number"
                      min={1}
                      name="position"
                      defaultValue={selected.learningItems.length + 1}
                      className={field}
                    />
                  </label>
                </div>
              </ActionForm>
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
                      activityVersionId: data.get("activityVersionId"),
                      rubricVersionId: data.get("rubricId"),
                      mode: data.get("mode"),
                      maxAttempts: Number(data.get("attempts")),
                      maxRevisions: Number(data.get("revisions")),
                      opensAt: iso(data.get("opensAt")),
                      dueAt: iso(data.get("dueAt")),
                      allowLate: data.get("allowLate") === "on",
                      ...(data.get("seconds")
                        ? { timeLimitSeconds: Number(data.get("seconds")) }
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
                    {selected.assignments.map((a) => (
                      <option key={a.id} value={a.id}>
                        New version of: {a.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  Assignment title
                  <input required name="title" className={field} />
                </label>
                <label className="block text-sm">
                  Activity version
                  <select required name="activityVersionId" className={field}>
                    <option value="">Choose Writing activity</option>
                    {selected.learningItems
                      .filter(
                        (i) => i.practiceActivity?.skillArea === "WRITING",
                      )
                      .flatMap((i) =>
                        i.practiceActivity!.activityVersions.map((v) => (
                          <option key={v.id} value={v.id}>
                            {i.title} v{v.versionNo}
                          </option>
                        )),
                      )}
                  </select>
                </label>
                <label className="block text-sm">
                  Rubric
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
                  Assessment mode
                  <select name="mode" className={field}>
                    <option value="PRACTICE">
                      Practice: provisional AI feedback allowed by release
                      policy
                    </option>
                    <option value="GRADED">
                      Graded: instructor confirmation required
                    </option>
                  </select>
                </label>
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
                  <label className="text-sm">
                    Due at
                    <input
                      name="dueAt"
                      type="datetime-local"
                      className={field}
                    />
                  </label>
                </div>
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
                    {["IMMEDIATE", "MANUAL", "AFTER_DUE_DATE", "SCHEDULED"].map(
                      (v) => (
                        <option key={v}>{v}</option>
                      ),
                    )}
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
              </ActionForm>
            </div>
          ) : (
            <p className={panel}>
              Course content is edited by assigned instructors. Use
              Administration to assign an instructor.
            </p>
          )}
          <section className={panel}>
            <h2 className="text-lg font-bold">Content and assignments</h2>
            {selected.learningItems.map((i) => (
              <p key={i.id} className="text-sm">
                {i.position}. {i.title} · {i.kind}
              </p>
            ))}
            {selected.assignments.map((a) => (
              <p key={a.id} className="text-sm font-semibold">
                {a.title} ·{" "}
                {a.assignmentVersions
                  .map((v) => `v${v.versionNo} ${v.mode}`)
                  .join(", ")}
              </p>
            ))}
          </section>
        </>
      )}
      <div className="grid items-start gap-5 lg:grid-cols-2">
        {instructor && template && (
          <ActionForm
            title="Publish a Task 2 rubric"
            busy={busy}
            submit={(data) =>
              run("POST", "/grading/rubrics", {
                rubricCode: data.get("code"),
                versionNo: Number(data.get("version")),
                title: data.get("title"),
                taskType: "WRITING_TASK_2",
                criteria: template.criteria.map((c) => ({
                  code: c.code,
                  name: c.name,
                  definition: data.get(c.code),
                })),
              })
            }
          >
            <label className="block text-sm">
              Rubric code
              <input required name="code" maxLength={60} className={field} />
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
            {template.criteria.map((c) => (
              <label key={c.code} className="block text-sm">
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
              <input required name="model" maxLength={120} className={field} />
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
      </div>
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
    </main>
  );
}

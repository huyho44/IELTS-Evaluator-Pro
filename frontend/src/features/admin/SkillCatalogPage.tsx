import { useState } from "react";
import ActionForm from "../management/ActionForm";
import {
  field,
  managementRequest,
  panel,
  type SkillRow,
} from "../management/managementApi";
import AdminSection from "./AdminSection";
import { useAdminSection } from "./useAdminSection";

const loadSkills = () => managementRequest<SkillRow[]>("GET", "/skills");

const AREA_BADGES: Record<string, string> = {
  WRITING: "border border-violet-200 bg-violet-50 text-violet-900",
  READING: "border border-sky-200 bg-sky-50 text-sky-900",
  LISTENING: "border border-teal-200 bg-teal-50 text-teal-900",
  SPEAKING: "border border-amber-200 bg-amber-50 text-amber-900",
};

export default function SkillCatalogPage() {
  const section = useAdminSection(loadSkills);
  const { busy, run } = section;
  const skills = section.data ?? [];

  const [query, setQuery] = useState("");
  const [statusTab, setStatusTab] = useState<"ALL" | "PUBLISHED" | "ARCHIVED">("ALL");
  const [areaFilter, setAreaFilter] = useState("ALL");
  const [authoringTab, setAuthoringTab] = useState<"prerequisites" | "publish">("prerequisites");
  const [targetSkillId, setTargetSkillId] = useState("");
  const [editedDrafts, setEditedDrafts] = useState<{
    skillId: string;
    drafts: { prerequisiteSkillId: string; minStrength: string; minSupport: string }[];
  } | null>(null);
  const [candidateSkillId, setCandidateSkillId] = useState("");
  const [candidateStrength, setCandidateStrength] = useState("0.6");
  const [candidateSupport, setCandidateSupport] = useState("0.33");
  const [prereqNotice, setPrereqNotice] = useState("");

  const publishedCount = skills.filter((s) => s.status === "PUBLISHED").length;
  const archivedCount = skills.filter((s) => s.status === "ARCHIVED").length;
  const keyword = query.trim().toLowerCase();

  const filteredSkills = skills.filter((s) => {
    const matchesQuery =
      !keyword ||
      `${s.name} ${s.code} ${s.skillArea} ${s.observableDefinition}`
        .toLowerCase()
        .includes(keyword);
    const matchesStatus = statusTab === "ALL" || s.status === statusTab;
    const matchesArea = areaFilter === "ALL" || s.skillArea === areaFilter;
    return matchesQuery && matchesStatus && matchesArea;
  });

  const targetSkill = skills.find((s) => s.id === targetSkillId);
  const savedDrafts = (targetSkill?.skillPrerequisites ?? []).map((p) => ({
    prerequisiteSkillId: p.prerequisiteSkillId,
    minStrength: p.minStrength ?? "",
    minSupport: p.minSupport ?? "",
  }));
  const activeDrafts =
    editedDrafts?.skillId === targetSkillId ? editedDrafts.drafts : savedDrafts;
  const linkedIds = new Set(activeDrafts.map((d) => d.prerequisiteSkillId));
  const eligibleCandidates = targetSkill
    ? skills.filter(
        (s) =>
          s.skillArea === targetSkill.skillArea &&
          s.id !== targetSkill.id &&
          !linkedIds.has(s.id),
      )
    : [];

  function selectTargetSkill(skillId: string) {
    setTargetSkillId(skillId);
    setEditedDrafts(null);
    setCandidateSkillId("");
    setCandidateStrength("0.6");
    setCandidateSupport("0.33");
    setPrereqNotice("");
    setAuthoringTab("prerequisites");
  }

  function updateDrafts(
    nextDrafts: { prerequisiteSkillId: string; minStrength: string; minSupport: string }[],
  ) {
    if (!targetSkillId) return;
    setEditedDrafts({ skillId: targetSkillId, drafts: nextDrafts });
    setPrereqNotice("");
  }

  function addCandidatePrerequisite(skillIdToAdd = candidateSkillId) {
    if (!targetSkill || !skillIdToAdd) return;
    if (!eligibleCandidates.some((s) => s.id === skillIdToAdd)) return;
    updateDrafts([
      ...activeDrafts,
      {
        prerequisiteSkillId: skillIdToAdd,
        minStrength: candidateStrength,
        minSupport: candidateSupport,
      },
    ]);
    setCandidateSkillId("");
  }

  return (
    <AdminSection
      title="Skill catalog"
      description="Browse published and archived IELTS skills, publish new skills, and manage prerequisite thresholds."
      {...section}
    >
      <div className="space-y-6">
        <section className={`${panel} shadow-2xs`} aria-label="Skill catalog list">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Published and archived skills
              </h2>
              <p className="text-xs text-slate-500">
                Filter skills by publication status or skill area, inspect prerequisites, and archive or restore entries.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: "ALL", label: `All (${skills.length})` },
                  { id: "PUBLISHED", label: `Published (${publishedCount})` },
                  { id: "ARCHIVED", label: `Archived (${archivedCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusTab(tab.id)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    statusTab === tab.id
                      ? "bg-violet-700 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Search skills
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by code, name, or observable definition..."
                className={`${field} mt-1 font-normal`}
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Skill area
              <select
                value={areaFilter}
                onChange={(event) => setAreaFilter(event.target.value)}
                className={`${field} mt-1 font-normal`}
              >
                <option value="ALL">All skill areas</option>
                {["WRITING", "READING", "LISTENING", "SPEAKING"].map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {section.data && !filteredSkills.length ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center text-sm text-slate-600">
              No skills match the active filters.
            </p>
          ) : (
            <div className="grid gap-3.5 md:grid-cols-2">
              {filteredSkills.map((s) => {
                const isPublished = s.status === "PUBLISHED";
                return (
                  <article
                    key={s.id}
                    className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition hover:border-violet-200"
                  >
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-slate-900">
                            {s.name}
                          </h3>
                          <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-600">
                            {s.code}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              AREA_BADGES[s.skillArea] ??
                              "border border-slate-200 bg-slate-100 text-slate-700"
                            }`}
                          >
                            {s.skillArea}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              isPublished
                                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                                : "border border-slate-200 bg-slate-100 text-slate-700"
                            }`}
                          >
                            {s.status}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm leading-relaxed text-slate-600">
                        {s.observableDefinition}
                      </p>

                      <div className="space-y-1.5 pt-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Prerequisites
                        </p>
                        {s.skillPrerequisites.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {s.skillPrerequisites.map((p) => {
                              const prereq = skills.find(
                                (v) => v.id === p.prerequisiteSkillId,
                              );
                              return (
                                <span
                                  key={p.prerequisiteSkillId}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50/70 px-2.5 py-1 text-xs font-medium text-violet-950"
                                >
                                  <span>{prereq?.name ?? "Unavailable skill"}</span>
                                  <span className="text-[10px] font-normal text-violet-700">
                                    ({p.minStrength ?? "default 0.6"} /{" "}
                                    {p.minSupport ?? "default 0.33"})
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400">None configured</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          selectTargetSkill(s.id);
                          document
                            .getElementById("skill-authoring-panel")
                            ?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                        className="text-xs font-semibold text-violet-800 hover:underline"
                      >
                        Edit prerequisites
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                          isPublished
                            ? "border-slate-200 bg-white text-slate-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-800"
                            : "border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100"
                        }`}
                        onClick={() =>
                          void run("PATCH", `/skills/${s.id}`, {
                            status: isPublished ? "ARCHIVED" : "PUBLISHED",
                          })
                        }
                      >
                        {isPublished ? "Archive skill" : "Publish skill"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section
          id="skill-authoring-panel"
          className="space-y-4 scroll-mt-20"
          aria-label="Skill authoring workspace"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-2xs">
            <div className="flex flex-wrap gap-1.5" role="tablist">
              {(
                [
                  { id: "prerequisites", label: "Edit prerequisites" },
                  { id: "publish", label: "Publish a skill" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={authoringTab === tab.id}
                  onClick={() => setAuthoringTab(tab.id)}
                  className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                    authoringTab === tab.id
                      ? "bg-violet-700 text-white shadow-2xs"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              {authoringTab === "prerequisites"
                ? "Prerequisites require skills from the same skill area and replace the saved set on submit."
                : "Publish a new observable IELTS skill entry directly in PUBLISHED state."}
            </p>
          </div>

          {authoringTab === "publish" ? (
            <ActionForm
              title="Publish a skill"
              description="Create a new observable IELTS skill entry in PUBLISHED state."
              variant="admin"
              label="Publish skill"
              busy={busy}
              submit={(data) =>
                run("POST", "/skills", {
                  code: data.get("code"),
                  name: data.get("name"),
                  skillArea: data.get("skillArea"),
                  observableDefinition: data.get("definition"),
                  status: "PUBLISHED",
                })
              }
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-800">
                  Code <span className="text-red-600">*</span>
                  <input
                    required
                    name="code"
                    maxLength={80}
                    placeholder="e.g. writing.cohesion.linking"
                    className={`${field} mt-1`}
                  />
                </label>
                <label className="block text-sm font-medium text-slate-800">
                  Skill area <span className="text-red-600">*</span>
                  <select name="skillArea" className={`${field} mt-1`}>
                    {["WRITING", "READING", "LISTENING", "SPEAKING"].map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block text-sm font-medium text-slate-800">
                Name <span className="text-red-600">*</span>
                <input
                  required
                  name="name"
                  maxLength={160}
                  placeholder="e.g. Paragraph progression & referencing"
                  className={`${field} mt-1`}
                />
              </label>
              <label className="block text-sm font-medium text-slate-800">
                What can a teacher observe? <span className="text-red-600">*</span>
                <textarea
                  required
                  name="definition"
                  rows={3}
                  placeholder="Describe observable learner evidence in writing or objective performance..."
                  className={`${field} mt-1`}
                />
              </label>
            </ActionForm>
          ) : (
            <ActionForm
              title="Set skill prerequisites"
              description="Leave a threshold blank to use the default: 0.6 for strength and 0.33 for support."
              variant="admin"
              label="Save prerequisites"
              busy={busy}
              resetOnSuccess={false}
              submitDisabled={!targetSkill}
              submit={async () => {
                if (!targetSkill) return false;
                const pendingCandidate =
                  candidateSkillId &&
                  eligibleCandidates.some((s) => s.id === candidateSkillId)
                    ? [
                        {
                          prerequisiteSkillId: candidateSkillId,
                          minStrength: candidateStrength,
                          minSupport: candidateSupport,
                        },
                      ]
                    : [];
                const finalDrafts = [...activeDrafts, ...pendingCandidate];
                const ok = await run(
                  "PUT",
                  `/skills/${targetSkill.id}/prerequisites`,
                  {
                    prerequisites: finalDrafts
                      .filter((item) => item.prerequisiteSkillId !== targetSkill.id)
                      .map((item) => ({
                        prerequisiteSkillId: item.prerequisiteSkillId,
                        minStrength:
                          item.minStrength.trim() === ""
                            ? null
                            : Number(item.minStrength),
                        minSupport:
                          item.minSupport.trim() === ""
                            ? null
                            : Number(item.minSupport),
                      })),
                  },
                );
                if (ok) {
                  setEditedDrafts(null);
                  setCandidateSkillId("");
                  setPrereqNotice(
                    `Saved ${finalDrafts.length} prerequisite${
                      finalDrafts.length === 1 ? "" : "s"
                    } for ${targetSkill.name}.`,
                  );
                }
                return ok;
              }}
            >
              <label className="block text-sm font-medium text-slate-800">
                Target skill <span className="text-red-600">*</span>
                <select
                  required
                  name="skillId"
                  value={targetSkillId}
                  onChange={(event) => selectTargetSkill(event.target.value)}
                  className={`${field} mt-1`}
                >
                  <option value="">Choose a skill from catalog or dropdown</option>
                  {skills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.skillArea}: {s.name} ({s.skillPrerequisites.length})
                    </option>
                  ))}
                </select>
              </label>

              {!targetSkill ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-4 text-sm text-slate-600">
                  Select <strong>Edit prerequisites</strong> on any skill card above or choose a target skill to view and update its prerequisites.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-200 bg-violet-50/60 px-3.5 py-2.5 text-xs text-violet-950">
                    <div>
                      <span className="font-semibold">{targetSkill.name}</span>{" "}
                      <span className="font-mono text-[11px] text-violet-700">
                        {targetSkill.code}
                      </span>
                    </div>
                    <span className="rounded-full border border-violet-200 bg-white px-2.5 py-0.5 font-semibold text-violet-900">
                      Area: {targetSkill.skillArea}
                    </span>
                  </div>

                  {prereqNotice && (
                    <p
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900"
                      role="status"
                    >
                      {prereqNotice}
                    </p>
                  )}

                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Configured prerequisites ({activeDrafts.length})
                      </p>
                      {activeDrafts.length > 0 && (
                        <button
                          type="button"
                          onClick={() => updateDrafts([])}
                          className="text-xs font-semibold text-rose-700 hover:underline"
                        >
                          Clear all
                        </button>
                      )}
                    </div>

                    {activeDrafts.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3.5 py-3 text-xs text-slate-500">
                        No prerequisites configured yet. Add one below from{" "}
                        <strong>{targetSkill.skillArea}</strong>.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {activeDrafts.map((draft, index) => {
                          const linkedSkill = skills.find(
                            (v) => v.id === draft.prerequisiteSkillId,
                          );
                          return (
                            <div
                              key={draft.prerequisiteSkillId}
                              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:flex-row sm:items-end sm:justify-between"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-900">
                                  {linkedSkill?.name ?? "Unavailable skill"}
                                </p>
                                <p className="font-mono text-[11px] text-slate-500">
                                  {linkedSkill?.code ?? draft.prerequisiteSkillId}
                                </p>
                              </div>
                              <div className="grid grid-cols-2 gap-2 sm:w-56">
                                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                  Min strength
                                  <input
                                    type="number"
                                    min={0}
                                    max={1}
                                    step={0.0001}
                                    placeholder="0.6"
                                    value={draft.minStrength}
                                    onChange={(event) => {
                                      const next = activeDrafts.map((item, idx) =>
                                        idx === index
                                          ? { ...item, minStrength: event.target.value }
                                          : item,
                                      );
                                      updateDrafts(next);
                                    }}
                                    className={`${field} mt-1 py-1.5 text-xs font-normal`}
                                  />
                                </label>
                                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                  Min support
                                  <input
                                    type="number"
                                    min={0}
                                    max={1}
                                    step={0.0001}
                                    placeholder="0.33"
                                    value={draft.minSupport}
                                    onChange={(event) => {
                                      const next = activeDrafts.map((item, idx) =>
                                        idx === index
                                          ? { ...item, minSupport: event.target.value }
                                          : item,
                                      );
                                      updateDrafts(next);
                                    }}
                                    className={`${field} mt-1 py-1.5 text-xs font-normal`}
                                  />
                                </label>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  updateDrafts(
                                    activeDrafts.filter(
                                      (item) =>
                                        item.prerequisiteSkillId !==
                                        draft.prerequisiteSkillId,
                                    ),
                                  )
                                }
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:border-rose-200 hover:bg-rose-50"
                              >
                                Remove
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Add prerequisite ({targetSkill.skillArea} only)
                    </p>
                    {eligibleCandidates.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        All other skills in {targetSkill.skillArea} are already linked.
                      </p>
                    ) : (
                      <>
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_auto] sm:items-end">
                          <label className="block text-xs font-medium text-slate-700">
                            Skill from {targetSkill.skillArea}
                            <select
                              name="candidatePrerequisite"
                              value={candidateSkillId}
                              onChange={(event) =>
                                setCandidateSkillId(event.target.value)
                              }
                              className={`${field} mt-1`}
                            >
                              <option value="">Select skill to add</option>
                              {eligibleCandidates.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name} ({s.code})
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block text-xs font-medium text-slate-700">
                            Min strength
                            <input
                              type="number"
                              min={0}
                              max={1}
                              step={0.0001}
                              placeholder="0.6"
                              disabled={!candidateSkillId}
                              value={candidateStrength}
                              onChange={(event) =>
                                setCandidateStrength(event.target.value)
                              }
                              className={`${field} mt-1`}
                            />
                          </label>
                          <label className="block text-xs font-medium text-slate-700">
                            Min support
                            <input
                              type="number"
                              min={0}
                              max={1}
                              step={0.0001}
                              placeholder="0.33"
                              disabled={!candidateSkillId}
                              value={candidateSupport}
                              onChange={(event) =>
                                setCandidateSupport(event.target.value)
                              }
                              className={`${field} mt-1`}
                            />
                          </label>
                          <button
                            type="button"
                            disabled={!candidateSkillId}
                            onClick={() => addCandidatePrerequisite()}
                            className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-900 hover:bg-violet-100 disabled:opacity-40"
                          >
                            + Add link
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </ActionForm>
          )}
        </section>
      </div>
    </AdminSection>
  );
}

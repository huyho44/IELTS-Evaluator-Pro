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

export default function SkillCatalogPage() {
  const section = useAdminSection(loadSkills);
  const { busy, run } = section;
  const skills = section.data ?? [];

  return (
    <AdminSection
      title="Skill catalog"
      description="Publish skills and manage their prerequisites."
      {...section}
    >
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <ActionForm
          title="Publish a skill"
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
          <label className="block text-sm">
            Code
            <input required name="code" maxLength={80} className={field} />
          </label>
          <label className="block text-sm">
            Name
            <input required name="name" maxLength={160} className={field} />
          </label>
          <label className="block text-sm">
            Skill area
            <select name="skillArea" className={field}>
              {["WRITING", "READING", "LISTENING", "SPEAKING"].map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            What can a teacher observe?
            <textarea required name="definition" className={field} />
          </label>
        </ActionForm>
        <ActionForm
          title="Set skill prerequisites"
          busy={busy}
          submit={(data) =>
            run("PUT", `/skills/${data.get("skillId")}/prerequisites`, {
              prerequisites: data.getAll("prerequisite").map((id) => ({
                prerequisiteSkillId: id,
                minStrength: Number(data.get("strength")),
                minSupport: Number(data.get("support")),
              })),
            })
          }
        >
          <label className="block text-sm">
            Target skill
            <select required name="skillId" className={field}>
              <option value="">Choose skill</option>
              {skills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.skillArea}: {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Required skills (Ctrl/Cmd-click to select multiple; none clears
            prerequisites)
            <select
              multiple
              name="prerequisite"
              className={`${field} min-h-36`}
            >
              {skills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.skillArea}: {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Minimum strength
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              name="strength"
              defaultValue={0.6}
              className={field}
            />
          </label>
          <label className="block text-sm">
            Minimum evidence support
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              name="support"
              defaultValue={0.33}
              className={field}
            />
          </label>
        </ActionForm>
        <section className={panel}>
          <h2 className="text-lg font-bold">Published and archived skills</h2>
          {skills.map((s) => (
            <div key={s.id} className="border-t pt-3">
              <p className="font-semibold">
                {s.name} · {s.status}
              </p>
              <p className="text-sm text-slate-600">{s.observableDefinition}</p>
              <p className="mt-1 text-xs text-slate-500">
                Prerequisites:{" "}
                {s.skillPrerequisites
                  .map(
                    (p) =>
                      skills.find((v) => v.id === p.prerequisiteSkillId)
                        ?.name ?? "Unavailable skill",
                  )
                  .join(", ") || "None"}
              </p>
              <button
                disabled={busy}
                className="mt-2 text-sm font-semibold text-blue-700"
                onClick={() =>
                  void run("PATCH", `/skills/${s.id}`, {
                    status: s.status === "PUBLISHED" ? "ARCHIVED" : "PUBLISHED",
                  })
                }
              >
                {s.status === "PUBLISHED" ? "Archive skill" : "Publish skill"}
              </button>
            </div>
          ))}
        </section>
      </div>
    </AdminSection>
  );
}

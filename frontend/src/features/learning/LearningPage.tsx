import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession } from "../auth/session";
import { StudentApiError } from "../../lib/api/studentRequest";
import {
  describeSkill,
  getLearningRecommendations,
  getSkillProfile,
  recommendedLessonPath,
  startRecommendedAttempt,
  type Recommendation,
  type RecommendationRun,
  type SkillProfile,
} from "./learningApi";

const REASON_BADGES: Record<string, { label: string; className: string }> = {
  DIAGNOSTIC: {
    label: "Explore a skill",
    className: "bg-[#eef2ff] text-[#3730a3]",
  },
  REINFORCEMENT: {
    label: "Reinforce a skill",
    className: "bg-[#ecfdf5] text-[#047857]",
  },
};

const DEFAULT_REASON_BADGE = {
  label: "Focused practice",
  className: "bg-[#eff6ff] text-[#1e40af]",
};

const SKILL_CARD_THEMES: Record<string, { card: string; badge: string }> = {
  "Needs focused practice": {
    card: "border-[#fde68a] bg-[#fffbeb]",
    badge: "bg-[#fef3c7] text-[#92400e]",
  },
  "Usually demonstrated": {
    card: "border-[#a7f3d0] bg-[#ecfdf5]",
    badge: "bg-[#d1fae5] text-[#047857]",
  },
  Developing: {
    card: "border-[#bfdbfe] bg-[#eff6ff]",
    badge: "bg-[#dbeafe] text-[#1e40af]",
  },
};

type Props = { accessToken?: string | null; onSessionExpired?: () => void };

export default function LearningPage(props: Props) {
  const { requestToken, session } = useSession();
  return (
    <LearningContent
      key={session?.user.id ?? "guest"}
      accessToken={props.accessToken ?? requestToken ?? ""}
      onSessionExpired={props.onSessionExpired}
    />
  );
}

function LearningContent({
  accessToken,
  onSessionExpired,
}: {
  accessToken: string;
  onSessionExpired?: () => void;
}) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<SkillProfile | null>(null);
  const [recommendations, setRecommendations] =
    useState<RecommendationRun | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const action = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [skills, suggestions] = await Promise.all([
          getSkillProfile(accessToken, controller.signal),
          getLearningRecommendations(accessToken, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setProfile(skills);
        setRecommendations(suggestions);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load your learning profile.",
        );
        if (cause instanceof StudentApiError && cause.status === 401)
          onSessionExpired?.();
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [accessToken, onSessionExpired, reloadKey]);

  async function open(item: Recommendation) {
    if (action.current) return;
    const lesson = recommendedLessonPath(item);
    if (lesson) {
      navigate(lesson);
      return;
    }
    action.current = true;
    setOpening(item.id);
    setError("");
    try {
      const attempt = await startRecommendedAttempt(item, accessToken);
      if (mounted.current)
        navigate(`/attempts/${encodeURIComponent(attempt.id)}`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to open this suggested practice.",
      );
      if (cause instanceof StudentApiError && cause.status === 401)
        onSessionExpired?.();
    } finally {
      action.current = false;
      setOpening("");
    }
  }

  const hasSuggestedPractice =
    recommendations?.recommendedActivities.some(
      (item) => item.learningItem.kind === "PRACTICE",
    ) ?? false;

  const observedSkills =
    profile?.skills.filter(
      (skill) => describeSkill(skill) !== "Not observed yet",
    ) ?? [];
  const unobservedSkills =
    profile?.skills.filter(
      (skill) => describeSkill(skill) === "Not observed yet",
    ) ?? [];

  return (
    <main className="mx-auto max-w-[1280px] space-y-5 px-4 py-4 sm:space-y-6 sm:px-8 sm:py-7">
      <header className="flex flex-col items-start justify-between gap-3 rounded-xl border border-[#e2e8f0] bg-white p-3.5 sm:flex-row sm:items-start sm:gap-4 sm:p-5">
        <div className="min-w-0 space-y-1.5">
          <span className="block text-xs font-semibold uppercase tracking-wide text-[#2563eb]">
            Your learning
          </span>
          <h1 className="text-xl font-semibold leading-tight text-[#0f172a] sm:text-[28px] sm:font-bold">
            Skills and next steps
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-[#64748b]">
            Build on confirmed feedback. Start with a diagnostic activity when
            you have little or no evidence.
          </p>
        </div>
        <button
          type="button"
          disabled={loading || !!opening}
          onClick={() => setReloadKey((value) => value + 1)}
          className="shrink-0 rounded-[10px] border border-[#e2e8f0] bg-white px-3 py-1.5 text-sm font-medium text-[#1e40af] transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563eb] disabled:opacity-50"
        >
          {loading ? (
            "Updating..."
          ) : (
            <>
              <span className="sm:hidden">Refresh</span>
              <span className="hidden sm:inline">
                Refresh skills and suggestions
              </span>
            </>
          )}
        </button>
      </header>

      <nav
        aria-label="Quick student links"
        className="flex flex-wrap items-center gap-2 xl:hidden"
      >
        <Link
          to="/courses"
          className="rounded-[10px] border border-[#e2e8f0] bg-white px-3 py-1.5 text-sm font-medium text-[#0f172a] transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563eb]"
        >
          Courses
        </Link>
        <Link
          to="/practice-history"
          className="rounded-[10px] border border-[#e2e8f0] bg-white px-3 py-1.5 text-sm font-medium text-[#0f172a] transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563eb]"
        >
          My Practice Attempts
        </Link>
      </nav>

      {error && (
        <div
          role="alert"
          className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <p>{error}</p>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              disabled={loading || !!opening}
              onClick={() => setReloadKey((value) => value + 1)}
              className="font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-700"
            >
              Try again
            </button>
            <Link
              to="/practice-history"
              className="font-medium underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-700"
            >
              Check your practice history
            </Link>
          </div>
        </div>
      )}

      {loading && (
        <p
          role="status"
          className="rounded-xl border border-[#e2e8f0] bg-white px-4 py-3 text-sm text-[#64748b]"
        >
          Loading your skills and suggested activities...
        </p>
      )}

      {recommendations && (
        <section
          aria-labelledby="suggested-activities-heading"
          className="space-y-3.5 rounded-2xl border border-blue-200/80 bg-gradient-to-b from-[#eff6ff]/70 to-white p-4 shadow-sm sm:p-6"
        >
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#2563eb]">
                Recommended next steps
              </span>
              <h2
                id="suggested-activities-heading"
                className="text-xl font-bold text-[#0f172a]"
              >
                Suggested next activities
              </h2>
              <p className="text-sm leading-relaxed text-[#64748b]">
                Based on your confirmed learning evidence and available course
                activities.
              </p>
            </div>
          </div>

          {hasSuggestedPractice && (
            <p className="rounded-xl border border-blue-200 bg-white/90 px-3.5 py-2.5 text-xs leading-relaxed text-[#1e40af]">
              Starting a suggested practice uses an available attempt and begins
              its time limit. An existing in-progress attempt for that version
              will resume.
            </p>
          )}

          {!recommendations.recommendedActivities.length ? (
            <p className="rounded-xl border border-[#e2e8f0] bg-white p-5 text-sm text-[#64748b]">
              No suitable activity is available right now. Browse your enrolled
              courses or ask your instructor about the next practice.
            </p>
          ) : (
            <div className="grid items-stretch gap-3.5 lg:grid-cols-3">
              {recommendations.recommendedActivities.map((item) => {
                const badge =
                  REASON_BADGES[item.reasonCode] ?? DEFAULT_REASON_BADGE;
                const isLesson = item.learningItem.kind === "LESSON";
                return (
                  <article
                    key={item.id}
                    className="flex flex-col rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm sm:p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">
                        {isLesson ? "Lesson" : "Practice"}
                      </span>
                    </div>
                    <h3 className="mt-3 text-base font-bold leading-snug text-[#0f172a] sm:text-lg">
                      {item.learningItem.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#64748b]">
                      {item.reasonText}
                    </p>
                    <div className="mt-auto pt-4">
                      <button
                        type="button"
                        disabled={!!opening || loading}
                        onClick={() => void open(item)}
                        className={
                          isLesson
                            ? "w-full rounded-[10px] border border-[#e2e8f0] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#0f172a] transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563eb] disabled:opacity-50"
                            : "w-full rounded-[10px] bg-[#2563eb] px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563eb] disabled:opacity-50"
                        }
                      >
                        {opening === item.id
                          ? "Opening..."
                          : isLesson
                            ? "Open lesson"
                            : "Start suggested practice"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {profile && (
        <section
          aria-labelledby="skill-evidence-heading"
          className="space-y-3.5 rounded-2xl border border-[#e2e8f0] bg-white p-4 sm:p-6"
        >
          <div className="space-y-1">
            <h2
              id="skill-evidence-heading"
              className="text-xl font-bold text-[#0f172a]"
            >
              Your skill evidence
            </h2>
            <p className="text-sm leading-relaxed text-[#64748b]">
              Only accepted, published assessments update these observations.
              They describe the evidence so far and are not an IELTS band
              prediction.
            </p>
          </div>

          {!profile.skills.length ? (
            <p className="rounded-xl border border-[#e2e8f0] bg-slate-50 p-5 text-sm text-[#64748b]">
              Your instructor has not published any skills yet.
            </p>
          ) : (
            <div className="space-y-4">
              {observedSkills.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {observedSkills.map((skill) => {
                    const statusLabel = describeSkill(skill);
                    const theme = SKILL_CARD_THEMES[statusLabel] ?? {
                      card: "border-[#e2e8f0] bg-white",
                      badge: "bg-[#f1f5f9] text-[#475569]",
                    };
                    return (
                      <article
                        key={skill.skillId}
                        className={`flex flex-col items-start gap-2 rounded-xl border p-4 ${theme.card}`}
                      >
                        <div className="flex w-full items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold text-[#0f172a]">
                            {skill.name}
                          </h3>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${theme.badge}`}
                        >
                          {statusLabel}
                        </span>
                        <p className="text-xs leading-relaxed text-[#475569]">
                          Based on {skill.evidenceCount} confirmed learning{" "}
                          {skill.evidenceCount === 1
                            ? "opportunity"
                            : "opportunities"}
                          .
                          {skill.observationStatus === "INSUFFICIENT" &&
                            " More observations are needed before drawing a stable conclusion."}
                        </p>
                      </article>
                    );
                  })}
                </div>
              )}

              {unobservedSkills.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-[#0f172a]">
                        Not observed yet
                      </h3>
                      <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {unobservedSkills.length}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-[#64748b]">
                      Complete a diagnostic activity or receive confirmed
                      instructor feedback to build evidence for these skills.
                    </p>
                  </div>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {unobservedSkills.map((skill) => (
                      <li
                        key={skill.skillId}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                      >
                        <span className="font-medium text-[#0f172a]">
                          {skill.name}
                        </span>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-[#475569]">
                          No evidence yet
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

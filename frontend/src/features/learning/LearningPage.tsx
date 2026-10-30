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
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-8">
      <nav className="flex flex-wrap justify-between gap-3 text-sm font-semibold text-blue-600">
        <Link to="/courses">← Browse courses</Link>
        <Link to="/practice-history">My practice attempts</Link>
      </nav>
      <header className="rounded-xl border border-slate-200 bg-white p-6">
        <span className="text-xs font-bold uppercase tracking-wide text-blue-600">
          Your learning
        </span>
        <h1 className="mt-2 text-2xl font-bold">Skills and next steps</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Build on confirmed feedback with focused learning activities. New or
          unobserved skills start with diagnostic practice, so missing evidence
          is not treated as a weakness.
        </p>
        <button
          disabled={loading || !!opening}
          onClick={() => setReloadKey((value) => value + 1)}
          className="mt-4 rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50"
        >
          {loading ? "Updating..." : "Refresh skills and suggestions"}
        </button>
      </header>
      {error && (
        <div
          role="alert"
          className="space-y-2 rounded-lg bg-red-50 p-4 text-sm text-red-800"
        >
          <p>{error}</p>
          <button
            disabled={loading || !!opening}
            onClick={() => setReloadKey((value) => value + 1)}
            className="font-semibold underline"
          >
            Try again
          </button>
          <Link to="/practice-history" className="ml-4 underline">
            Check your practice history
          </Link>
        </div>
      )}
      {loading && (
        <p role="status" className="text-sm text-slate-500">
          Loading your skills and suggested activities...
        </p>
      )}
      {recommendations && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold">Suggested next activities</h2>
          <p className="text-sm text-slate-500">
            These suggestions use your confirmed learning evidence and the
            activities available in your courses.
          </p>
          {!recommendations.recommendedActivities.length ? (
            <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
              No suitable activity is available right now. Browse your enrolled
              courses or ask your instructor about the next practice.
            </p>
          ) : (
            <div className="grid items-start gap-4 lg:grid-cols-3">
              {recommendations.recommendedActivities.map((item) => (
                <article
                  key={item.id}
                  className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
                >
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                    {item.reasonCode === "DIAGNOSTIC"
                      ? "Explore a skill"
                      : item.reasonCode === "REINFORCEMENT"
                        ? "Reinforce a skill"
                        : "Focused practice"}
                  </span>
                  <h3 className="text-lg font-bold">
                    {item.learningItem.title}
                  </h3>
                  <p className="text-sm leading-6 text-slate-600">
                    {item.reasonText}
                  </p>
                  <button
                    disabled={!!opening || loading}
                    onClick={() => void open(item)}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {opening === item.id
                      ? "Opening..."
                      : item.learningItem.kind === "LESSON"
                        ? "Open lesson"
                        : "Start suggested practice"}
                  </button>
                  {item.learningItem.kind === "PRACTICE" && (
                    <p className="text-xs leading-5 text-slate-500">
                      Starting uses an available attempt and begins its time
                      limit. An existing attempt for this suggested version will
                      resume.
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      {profile && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold">Your skill evidence</h2>
          <p className="text-sm leading-6 text-slate-500">
            Only accepted, published assessments update these observations. They
            describe the evidence so far and are not an IELTS band prediction.
          </p>
          {!profile.skills.length ? (
            <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
              Your instructor has not published any skills yet.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {profile.skills.map((skill) => (
                <article
                  key={skill.skillId}
                  className="space-y-3 rounded-xl border border-slate-200 bg-white p-5"
                >
                  <h3 className="font-bold">{skill.name}</h3>
                  <p
                    className={`text-sm font-semibold ${skill.strength === null ? "text-slate-500" : "text-blue-700"}`}
                  >
                    {describeSkill(skill)}
                  </p>
                  <p className="text-xs leading-5 text-slate-500">
                    {skill.evidenceCount
                      ? `Based on ${skill.evidenceCount} confirmed learning ${skill.evidenceCount === 1 ? "opportunity" : "opportunities"}.`
                      : "Complete a diagnostic activity or receive confirmed instructor feedback to build evidence."}
                    {skill.observationStatus === "INSUFFICIENT" &&
                      " More observations are needed before drawing a stable conclusion."}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../../auth/session';
import { instructorApi } from '../services/instructorApi';
import type {
  CourseSummary,
  ReviewAssessment,
  ReviewDetail,
  ReviewQueueItem,
} from '../types';

const HYDRATED_CACHE_KEY = 'ielts_instructor_hydrated_reviews_v1';

type BandBucket = {
  label: string;
  min: number;
  max: number;
  count: number;
};

function loadCachedDetails(): Record<string, ReviewDetail> {
  try {
    const raw = localStorage.getItem(HYDRATED_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ReviewDetail>) : {};
  } catch {
    return {};
  }
}

function saveCachedDetails(map: Record<string, ReviewDetail>): void {
  try {
    localStorage.setItem(HYDRATED_CACHE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage limits
  }
}

function formatHours(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0.0h';
  const hours = ms / (1000 * 60 * 60);
  return `${hours.toFixed(1)}h`;
}

export default function GradingReportsPage() {
  const { session } = useSession();
  const currentUserId = session?.user.id ?? '';

  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [hydratedMap, setHydratedMap] = useState<Record<string, ReviewDetail>>(() =>
    loadCachedDetails(),
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [hydrating, setHydrating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & manual review inspection
  const [searchQuery, setSearchQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<'ALL' | 'WRITING' | 'SPEAKING' | 'OBJECTIVE'>(
    'ALL',
  );
  const [lookupReviewId, setLookupReviewId] = useState('');
  const [lookupStatus, setLookupStatus] = useState<string | null>(null);

  const loadReportData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [queueItems, publishedCourses] = await Promise.all([
        instructorApi.getReviewQueue(),
        instructorApi.getPublishedCourses(),
      ]);
      setQueue(queueItems);
      setCourses(publishedCourses);

      // Hydrate up to 25 open cases for score & criterion analytics
      const toFetch = queueItems.slice(0, 25);
      if (toFetch.length > 0) {
        setHydrating(true);
        const results = await Promise.allSettled(
          toFetch.map((item) => instructorApi.getReviewDetail(item.id)),
        );
        setHydratedMap((prev) => {
          const next = { ...prev };
          for (const res of results) {
            if (res.status === 'fulfilled') {
              next[res.value.id] = res.value;
            }
          }
          saveCachedDetails(next);
          return next;
        });
        setHydrating(false);
      }
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(
        e?.response?.data?.message || e?.message || 'Unable to load grading report data.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReportData();
  }, [loadReportData]);

  const handleInspectReviewId = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = lookupReviewId.trim();
    if (!id) return;
    setLookupStatus('Loading review case...');
    try {
      const detail = await instructorApi.getReviewDetail(id);
      setHydratedMap((prev) => {
        const next = { ...prev, [detail.id]: detail };
        saveCachedDetails(next);
        return next;
      });
      setLookupReviewId('');
      setLookupStatus(`Added review ${detail.id.slice(0, 8)}... (${detail.status}) to analytics.`);
    } catch {
      setLookupStatus('Could not load that Review ID (check UUID or course permission).');
    }
  };

  // ==========================================================================
  // Operational & Score Metrics
  // ==========================================================================

  const operationalStats = useMemo(() => {
    const now = Date.now();
    const pending = queue.filter((q) => q.status === 'PENDING').length;
    const claimed = queue.filter((q) => q.status === 'CLAIMED').length;
    const mine = queue.filter((q) => q.assigneeId === currentUserId).length;
    const flagged = queue.filter((q) => q.reasonCode === 'QUALITY_FLAGGED').length;
    const appeals = queue.filter((q) => q.reasonCode === 'LEARNER_APPEAL').length;

    const totalWaitMs = queue.reduce((sum, item) => {
      const submitted = new Date(item.revision.submittedAt).getTime();
      return sum + Math.max(0, now - submitted);
    }, 0);
    const avgWaitMs = queue.length > 0 ? totalWaitMs / queue.length : 0;

    const totalEnrollments = courses.reduce(
      (sum, c) => sum + (c._count?.enrollments ?? 0),
      0,
    );

    return {
      totalOpen: queue.length,
      pending,
      claimed,
      mine,
      flagged,
      appeals,
      avgWaitMs,
      totalCourses: courses.length,
      totalEnrollments,
    };
  }, [queue, courses, currentUserId]);

  const scoreAnalytics = useMemo(() => {
    const details = Object.values(hydratedMap);
    const preferredResults: ReviewAssessment[] = [];

    for (const d of details) {
      const results = d.revision.assessmentResults ?? [];
      const teacher = results.find((r) => r.kind === 'TEACHER');
      const ai = results.find((r) => r.kind === 'AI');
      const chosen = teacher ?? ai ?? results[0];
      if (chosen && chosen.overallScore != null) {
        preferredResults.push(chosen);
      }
    }

    const bandScores = preferredResults
      .filter((r) => r.scoreScale === 'BAND')
      .map((r) => Number(r.overallScore))
      .filter((n) => Number.isFinite(n));

    const avgBand =
      bandScores.length > 0
        ? bandScores.reduce((a, b) => a + b, 0) / bandScores.length
        : null;

    const buckets: BandBucket[] = [
      { label: 'Band ≤ 4.5', min: 0, max: 4.75, count: 0 },
      { label: 'Band 5.0 – 5.5', min: 4.75, max: 5.75, count: 0 },
      { label: 'Band 6.0 – 6.5', min: 5.75, max: 6.75, count: 0 },
      { label: 'Band 7.0 – 7.5', min: 6.75, max: 7.75, count: 0 },
      { label: 'Band 8.0 – 9.0', min: 7.75, max: 9.5, count: 0 },
    ];

    for (const score of bandScores) {
      const bucket = buckets.find((b) => score >= b.min && score < b.max);
      if (bucket) bucket.count += 1;
    }

    // Aggregate per-criterion averages
    const criterionTotals = new Map<
      string,
      { code: string; name: string; sum: number; count: number }
    >();
    for (const r of preferredResults) {
      for (const cs of r.criterionScores ?? []) {
        const val = Number(cs.score);
        if (!Number.isFinite(val)) continue;
        const key = cs.criterion.code;
        const entry = criterionTotals.get(key) ?? {
          code: cs.criterion.code,
          name: cs.criterion.name,
          sum: 0,
          count: 0,
        };
        entry.sum += val;
        entry.count += 1;
        criterionTotals.set(key, entry);
      }
    }

    const criterionAverages = Array.from(criterionTotals.values())
      .map((c) => ({
        ...c,
        avg: c.count > 0 ? c.sum / c.count : 0,
      }))
      .sort((a, b) => a.code.localeCompare(b.code));

    return {
      inspectedCount: details.length,
      scoredCount: bandScores.length,
      avgBand,
      buckets,
      criterionAverages,
    };
  }, [hydratedMap]);

  const reasonBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of queue) {
      counts.set(item.reasonCode, (counts.get(item.reasonCode) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [queue]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return queue.filter((item) => {
      if (modeFilter !== 'ALL' && item.revision.responseMode !== modeFilter) {
        return false;
      }
      if (!q) return true;
      const learner = item.revision.attempt.learner.displayName.toLowerCase();
      const title = item.revision.attempt.assignmentVersion.assignment.title.toLowerCase();
      const reason = item.reasonCode.toLowerCase();
      return learner.includes(q) || title.includes(q) || reason.includes(q);
    });
  }, [queue, searchQuery, modeFilter]);

  const handleExportCsv = () => {
    const headers = [
      'Review ID',
      'Status',
      'Reason Code',
      'Priority',
      'Response Mode',
      'Assignment',
      'Learner',
      'Submitted At',
      'Latest Band / Score',
    ];
    const lines = filteredRows.map((item) => {
      const detail = hydratedMap[item.id];
      const latestResult =
        detail?.revision.assessmentResults?.find((r) => r.kind === 'TEACHER') ??
        detail?.revision.assessmentResults?.[0];
      const score = latestResult?.overallScore ?? '';
      return [
        item.id,
        item.status,
        item.reasonCode,
        String(item.priority),
        item.revision.responseMode,
        `"${item.revision.attempt.assignmentVersion.assignment.title.replaceAll('"', '""')}"`,
        `"${item.revision.attempt.learner.displayName.replaceAll('"', '""')}"`,
        item.revision.submittedAt,
        String(score),
      ].join(',');
    });

    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `grading-report-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const maxBucketCount = Math.max(1, ...scoreAnalytics.buckets.map((b) => b.count));

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Grading Operations & Score Distribution
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitor review queue turnaround, AI quality flags, and IELTS band distribution
            across evaluated submissions.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void loadReportData()}
            disabled={loading}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredRows.length === 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {error}
        </div>
      )}

      {/* Top KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Open Review Queue
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {operationalStats.totalOpen}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {operationalStats.pending} pending · {operationalStats.claimed} claimed (
            {operationalStats.mine} mine)
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Avg Queue Wait Time
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {formatHours(operationalStats.avgWaitMs)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Elapsed since learner submission timestamp
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Mean Evaluated Band
          </p>
          <p className="mt-2 text-3xl font-bold text-blue-600">
            {scoreAnalytics.avgBand !== null ? scoreAnalytics.avgBand.toFixed(1) : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Across {scoreAnalytics.scoredCount} band-scored submission(s)
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Published Courses & Reach
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {operationalStats.totalCourses}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {operationalStats.totalEnrollments} active learner enrollments
          </p>
        </div>
      </div>

      {/* Analytics Panels: Band Distribution + Criterion & Queue Breakdown */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* IELTS Band Distribution */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                IELTS Band Score Distribution
              </h2>
              <p className="text-xs text-slate-500">
                Prioritizes confirmed Teacher band scores over preliminary AI estimates.
              </p>
            </div>
            {hydrating && (
              <span className="text-xs font-medium text-blue-600">Syncing details...</span>
            )}
          </div>

          {scoreAnalytics.scoredCount === 0 ? (
            <div className="my-8 rounded-lg border border-dashed border-slate-200 p-6 text-center">
              <p className="text-sm font-medium text-slate-600">
                No band-scored assessments loaded yet
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Once learners submit Writing/Speaking tasks or you inspect a review case below,
                band distribution bars will appear here.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-3.5">
              {scoreAnalytics.buckets.map((bucket) => {
                const pct = Math.round((bucket.count / maxBucketCount) * 100);
                return (
                  <div key={bucket.label}>
                    <div className="flex justify-between text-xs font-medium text-slate-700">
                      <span>{bucket.label}</span>
                      <span>
                        {bucket.count} ({Math.round((bucket.count / scoreAnalytics.scoredCount) * 100)}
                        %)
                      </span>
                    </div>
                    <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Include Confirmed / Historical Review ID */}
          <form
            onSubmit={(e) => void handleInspectReviewId(e)}
            className="mt-6 border-t border-slate-100 pt-4"
          >
            <label className="block text-xs font-semibold text-slate-600">
              Include Specific Review Case ID in Score Report
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                type="text"
                value={lookupReviewId}
                onChange={(e) => setLookupReviewId(e.target.value)}
                placeholder="Paste ReviewCase UUID..."
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-xs focus:border-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Load Case
              </button>
            </div>
            {lookupStatus && (
              <p className="mt-1.5 text-xs text-slate-500">{lookupStatus}</p>
            )}
          </form>
        </div>

        {/* Criterion Averages & Queue Triggers */}
        <div className="space-y-6 lg:col-span-6">
          {/* Criterion Performance */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <h2 className="text-base font-bold text-slate-900">
              Rubric Criterion Averages
            </h2>
            <p className="text-xs text-slate-500">
              Mean score (out of 9.0) across evaluated rubric criteria.
            </p>
            {scoreAnalytics.criterionAverages.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">
                Criterion scores will populate once AI or Teacher rubric results exist.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {scoreAnalytics.criterionAverages.map((c) => (
                  <div
                    key={c.code}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs font-bold text-blue-700">
                        {c.code}
                      </span>
                      <span className="text-base font-bold text-slate-900">
                        {c.avg.toFixed(1)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs font-medium text-slate-600">
                      {c.name}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Queue Escalation Reasons */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
            <h2 className="text-base font-bold text-slate-900">
              Open Queue Escalation Reasons
            </h2>
            {reasonBreakdown.length === 0 ? (
              <p className="py-4 text-xs text-slate-400">
                No open escalation cases in the review queue.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {reasonBreakdown.map(([code, count]) => (
                  <span
                    key={code}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    <span>{code}</span>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-900">
                      {count}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Queue & Assessment Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {(['ALL', 'WRITING', 'SPEAKING', 'OBJECTIVE'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModeFilter(m)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  modeFilter === m
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {m === 'ALL' ? 'All Modes' : m}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by learner, assignment, or reason..."
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none sm:w-72"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Learner</th>
                <th className="px-5 py-3">Assignment</th>
                <th className="px-5 py-3">Mode</th>
                <th className="px-5 py-3">Trigger</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Latest Score</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">
                    No submissions match the current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredRows.map((item) => {
                  const detail = hydratedMap[item.id];
                  const latestResult =
                    detail?.revision.assessmentResults?.find((r) => r.kind === 'TEACHER') ??
                    detail?.revision.assessmentResults?.[0];
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-3.5 font-medium text-slate-900">
                        {item.revision.attempt.learner.displayName}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {item.revision.attempt.assignmentVersion.assignment.title}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                          {item.revision.responseMode}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-600">
                        {item.reasonCode}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            item.status === 'CLAIMED'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-900">
                        {latestResult?.overallScore != null
                          ? `${latestResult.overallScore} (${latestResult.kind})`
                          : 'Awaiting'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          to={`/teacher/reviews/${item.id}`}
                          className="font-semibold text-blue-600 hover:underline"
                        >
                          Open Review →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
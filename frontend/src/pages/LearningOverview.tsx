import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyEnrollments } from '../features/courses/enrollmentsApi';
import { getPracticeHistory } from '../features/courses/practiceApi';
import { getLearningRecommendations } from '../features/learning/learningApi';

export default function LearningOverview({ token }: { token: string }) {
  const [data, setData] = useState<{ courses: Awaited<ReturnType<typeof getMyEnrollments>>; history: Awaited<ReturnType<typeof getPracticeHistory>>; suggestions: Awaited<ReturnType<typeof getLearningRecommendations>> }>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setError(false);
    Promise.all([getMyEnrollments(token,c.signal),getPracticeHistory(token,c.signal),getLearningRecommendations(token,c.signal)])
      .then(([courses,history,suggestions]) => { if (!c.signal.aborted) setData({courses,history,suggestions}); })
      .catch(() => { if (!c.signal.aborted) setError(true); });
    return () => c.abort();
  }, [token,retry]);
  if (error) return <p role="alert">Could not load learning progress. <button onClick={() => setRetry(n => n+1)}>Retry</button></p>;
  if (!data) return <p role="status">Loading learning progress…</p>;
  const next = data.suggestions.recommendedActivities[0];
  const enrolled = data.courses.filter(c => c.status !== 'LEFT');
  return <div className="my-6 grid gap-5">
    <section><h2 className="font-bold">Course progress</h2>
      <p>{enrolled.filter(c => c.status === 'COMPLETED').length} of {enrolled.length} enrolled courses completed</p>
      {enrolled.map(c => <Link className="block text-blue-700" key={c.id} to={'/courses/'+c.courseId}>{c.course.title} · {c.status.toLowerCase()}</Link>)}</section>
    <section><h2 className="font-bold">Recent practice</h2>{!data.history.length && <p>No attempts yet.</p>}
      {data.history.slice(0,3).map(a => <Link className="block text-blue-700" key={a.id} to={'/attempts/'+a.id}>Attempt {a.attemptNo} · {new Date(a.startedAt).toLocaleDateString()} · {a.status.toLowerCase().replaceAll('_',' ')}</Link>)}</section>
    <section><h2 className="font-bold">Suggested next step</h2>{next ? <><Link className="text-blue-700" to="/learning">{next.learningItem.title}</Link><p>{next.reasonText}</p></> : <p>No suggestions yet.</p>}</section>
  </div>;
}

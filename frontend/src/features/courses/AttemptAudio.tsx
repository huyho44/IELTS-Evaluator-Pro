import { useEffect, useState } from 'react';
import { sessionFetch } from '../auth/session';

export default function AttemptAudio({ attemptId, assetId, token, label }: { attemptId: string; assetId: string; token: string; label: string }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let source = '';
    setUrl(''); setError('');
    async function load() {
      const response = await sessionFetch('/api/attempts/' + attemptId + '/audio/' + assetId, { headers: { Authorization: 'Bearer ' + token }, signal: controller.signal });
      if (!response.ok) throw Error();
      const blob = await response.blob();
      if (!controller.signal.aborted) { source = URL.createObjectURL(blob); setUrl(source); }
    }
    void load().catch(() => { if (!controller.signal.aborted) setError('Recording unavailable.'); });
    return () => { controller.abort(); if (source) URL.revokeObjectURL(source); };
  }, [attemptId, assetId, token]);
  return <div className="my-3"><p>{label}</p>{url ? <audio controls src={url} aria-label={label} /> : <p role="status">{error || 'Loading audio…'}</p>}</div>;
}

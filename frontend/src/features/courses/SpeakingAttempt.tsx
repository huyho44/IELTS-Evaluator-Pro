import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { StudentAttempt } from '../writing/writingApi';
import { sessionFetch } from '../auth/session';
import AttemptAudio from './AttemptAudio';

export default function SpeakingAttempt({attempt, token}: {attempt: StudentAttempt; token: string}) {
  const [file,setFile] = useState<File>();
  const [preview,setPreview] = useState('');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [recording,setRecording] = useState(false);
  const [revision,setRevision] = useState(attempt.submissionRevisions[0]?.id ?? '');
  const [asset,setAsset] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const mounted = useRef(false);
  useEffect(() => { mounted.current=true; return () => { mounted.current=false; recorder.current?.stream.getTracks().forEach(track => track.stop()); }; }, []);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (!revision) return;
    const c = new AbortController();
    sessionFetch('/api/submissions/'+revision,{headers:{Authorization:'Bearer '+token},signal:c.signal})
      .then(async r => { if (!r.ok) throw Error(); const data = await r.json(); if (!c.signal.aborted) setAsset(data.audioAssetId); })
      .catch(() => { if (!c.signal.aborted) setError('Unable to load submitted recording.'); });
    return () => c.abort();
  }, [revision,token]);
  async function record() {
    setError(''); setBusy(true);
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({audio:true});
      if (!mounted.current) { stream.getTracks().forEach(t=>t.stop()); return; }
      const r = new MediaRecorder(stream); recorder.current=r;
      const chunks: Blob[]=[]; let size=0;
      r.ondataavailable = event => { chunks.push(event.data); size+=event.data.size; if(size>=12*1024*1024 && r.state==='recording') r.stop(); };
      r.onstop = () => {
        r.stream.getTracks().forEach(t=>t.stop()); if (!mounted.current) return;
        setRecording(false); setFile(new File(chunks,'recording',{type:r.mimeType.split(';')[0]}));
      };
      r.start(1000); setRecording(true);
    } catch { stream?.getTracks().forEach(t=>t.stop()); setError('Microphone unavailable. Choose an audio file instead.'); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function submit() {
    if (!file || busy) return;
    if (!file.size || file.size>12*1024*1024) { setError('Choose an audio file up to 12 MB.'); return; }
    setBusy(true); setError('');
    try {
      const body=new FormData(); body.append('audio',file); body.append('attemptId',attempt.id);
      const r=await sessionFetch('/api/assignments/'+attempt.assignmentId+'/speaking',{method:'POST',headers:{Authorization:'Bearer '+token},body});
      const result=await r.json(); if (!r.ok) throw Error(result.message || 'Submission failed');
      setRevision(result.revisionId); setFile(undefined);
    } catch(e) { setError(e instanceof Error ? e.message : 'Submission failed.'); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-3xl space-y-4 p-6">
    <h1 className="text-2xl font-bold">{attempt.assignmentVersion.assignment.title}</h1>
    <p>{attempt.assignmentVersion.activityVersion.promptText}</p><p>{attempt.assignmentVersion.activityVersion.instructions}</p>
    {error && <p role="alert">{error}</p>}
    {revision ? <><p role="status">Recording submitted.</p>{asset && <AttemptAudio attemptId={attempt.id} assetId={asset} token={token} label="Your submission" />}</> :
      attempt.status !== 'IN_PROGRESS' || (attempt.expiresAt && Date.parse(attempt.expiresAt)<=Date.now()) ? <p>This attempt is closed.</p> :
      <><button disabled={busy} className="rounded border px-3 py-2" onClick={recording ? () => recorder.current?.stop() : record}>{recording ? 'Stop recording' : 'Record using microphone'}</button>
      <label className="block">Or choose an audio file (up to 12 MB)<input className="block" type="file" accept="audio/webm,audio/mp4,audio/mpeg,audio/ogg,audio/wav,audio/x-wav" disabled={busy || recording} onChange={e=>{setFile(e.target.files?.[0]);setError('');}} /></label>
      {file && preview && <audio className="block" aria-label="Preview recording" controls src={preview}/>}
      <button className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50" disabled={!file || busy || recording} onClick={submit}>Submit recording</button></>}
    <Link className="block text-blue-700" to="/practice-history">Practice history</Link>
  </main>;
}

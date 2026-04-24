import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useFirstGreenhouse } from '../hooks/useGreenhouse.jsx';

export default function Diagnose() {
  const { gh } = useFirstGreenhouse();
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [err, setErr] = useState('');
  const fileRef = useRef(null);

  const loadHistory = async () => {
    if (!gh) return;
    setHistory(await api(`/diagnose/greenhouse/${gh.id}`));
  };
  useEffect(() => { loadHistory(); }, [gh?.id]);

  const onFile = (e) => {
    setErr(''); setResult(null);
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 7 * 1024 * 1024) { setErr('사진이 너무 큽니다 (최대 7MB)'); return; }
    const reader = new FileReader();
    reader.onload = () => setPreview({ dataUrl: reader.result, mime: f.type, name: f.name, size: f.size });
    reader.readAsDataURL(f);
  };

  const submit = async () => {
    if (!preview) return;
    setBusy(true); setErr(''); setResult(null);
    try {
      const r = await api(`/diagnose/greenhouse/${gh.id}`, {
        method: 'POST',
        body: JSON.stringify({ image_base64: preview.dataUrl.split(',')[1], mime: preview.mime }),
      });
      setResult(r);
      loadHistory();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const severityColor = (s) => ({ '심각': '#ff8f8f', '보통': '#ffd27a', '경미': '#7cc4ff', '없음': '#6bdd9b' })[s] || '#8a96a5';

  if (!gh) return <div className="empty">로딩중...</div>;

  return (
    <>
      <h2>🩺 병해 진단</h2>
      <p style={{ color: '#8a96a5', fontSize: 13, marginTop: -8 }}>
        딸기 잎·과실·줄기를 선명하게 찍어 업로드하면 AI가 병명과 조치를 알려드립니다. (Claude Opus 4.7 기반)
      </p>

      <div className="panel">
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} style={{ display: 'none' }} />
        {!preview && (
          <button onClick={() => fileRef.current?.click()} style={{ width: '100%', padding: 20 }}>
            📷 사진 선택 / 촬영
          </button>
        )}
        {preview && (
          <div>
            <img src={preview.dataUrl} alt="preview" style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8 }} />
            <div className="flex" style={{ marginTop: 12 }}>
              <button onClick={submit} disabled={busy}>{busy ? '진단중... (약 10-20초)' : '진단 시작'}</button>
              <button className="ghost" onClick={() => { setPreview(null); setResult(null); fileRef.current.value=''; }}>취소</button>
            </div>
          </div>
        )}
        {err && <p style={{ color: '#ff8f8f', marginTop: 10 }}>{err}</p>}
      </div>

      {result && (
        <div className="panel">
          <h2>진단 결과</h2>
          <div style={{ fontSize: 28, fontWeight: 600, color: severityColor(result.severity) }}>{result.disease}</div>
          <div style={{ marginTop: 6, fontSize: 14 }}>
            심각도 <b style={{ color: severityColor(result.severity) }}>{result.severity || '-'}</b>
            {result.confidence != null && <span style={{ marginLeft: 10, color: '#8a96a5' }}>신뢰도 {Math.round(result.confidence * 100)}%</span>}
          </div>
          {result.symptoms && <p style={{ marginTop: 12 }}><b>관찰된 증상:</b> {result.symptoms}</p>}
          {result.recommendation && (
            <div style={{ marginTop: 12, padding: 12, background: '#0f141c', borderRadius: 8, borderLeft: `4px solid ${severityColor(result.severity)}` }}>
              <b>권장 조치:</b>
              <div style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{result.recommendation}</div>
            </div>
          )}
          {result.urgency_hours && (
            <p style={{ marginTop: 10, color: '#8a96a5', fontSize: 13 }}>권장 조치 시한: {result.urgency_hours}시간 이내</p>
          )}
          {result.mode === 'degraded' && (
            <p style={{ marginTop: 10, color: '#ffd27a', fontSize: 12 }}>⚠ AI 진단 비활성 — 서버에 ANTHROPIC_API_KEY 설정 필요</p>
          )}
        </div>
      )}

      <div className="panel">
        <h2>진단 이력</h2>
        {history.length === 0 && <div className="empty">진단 이력이 없습니다</div>}
        <table>
          <tbody>
            {history.map((h) => (
              <tr key={h.id}>
                <td style={{ width: 140, fontSize: 12, color: '#8a96a5' }}>{h.ts?.slice(0, 16)}</td>
                <td><b style={{ color: severityColor(h.severity) }}>{h.disease}</b></td>
                <td style={{ color: '#8a96a5', fontSize: 13 }}>{h.severity}</td>
                <td style={{ fontSize: 13, color: '#8a96a5' }}>{h.confidence != null ? `${Math.round(h.confidence*100)}%` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

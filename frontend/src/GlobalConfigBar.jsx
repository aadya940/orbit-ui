import { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const LLM_SUGGESTIONS = [
  "gemini-3-flash-preview",
  "gemini-3-pro-preview",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "anthropic/claude-3-5-sonnet-20241022",
  "openrouter/google/gemini-flash-1.5",
];

function SecretsModal({ onClose }) {
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`${API}/secrets`)
      .then(r => r.json())
      .then(d => {
        // Pre-populate keys with blank values — values never returned from server
        setRows((d.keys || []).map(k => ({ key: k, value: '' })));
      })
      .catch(() => {});
  }, []);

  const update = (i, field, val) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  const remove = (i) => setRows(prev => prev.filter((_, idx) => idx !== i));

  const add = () => setRows(prev => [...prev, { key: '', value: '' }]);

  const save = async () => {
    setSaving(true);
    await fetch(`${API}/secrets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secrets: rows.filter(r => r.key.trim()) }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.35)',
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 20, width: 420,
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1a1a' }}>Secrets</div>
            <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>
              Reference in nodes as <code style={{ background: '#f4f3f0', padding: '1px 4px', borderRadius: 3 }}>{'{{secrets.KEY}}'}</code>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#aaa', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, marginBottom: 12 }}>
          {rows.length === 0 && (
            <div style={{ fontSize: 12, color: '#bbb', textAlign: 'center', padding: '20px 0' }}>
              No secrets yet. Add one below.
            </div>
          )}
          {rows.map((row, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 7, alignItems: 'center' }}>
              <input
                style={{ flex: 1, fontSize: 12, padding: '5px 8px', border: '1px solid #ddd', borderRadius: 5, fontFamily: 'Consolas, monospace' }}
                placeholder="KEY_NAME"
                value={row.key}
                onChange={e => update(i, 'key', e.target.value.toUpperCase().replace(/\s/g, '_'))}
              />
              <input
                type="password"
                style={{ flex: 1.5, fontSize: 12, padding: '5px 8px', border: '1px solid #ddd', borderRadius: 5 }}
                placeholder={row.value === '' && row.key ? '(unchanged)' : 'value'}
                value={row.value}
                onChange={e => update(i, 'value', e.target.value)}
              />
              <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 15, padding: '0 2px' }}>×</button>
            </div>
          ))}
        </div>

        <button
          onClick={add}
          style={{ width: '100%', padding: '6px', borderRadius: 6, border: '1px dashed #ddd', background: 'transparent', color: '#888', fontSize: 12, cursor: 'pointer', marginBottom: 10 }}
        >
          + Add secret
        </button>

        <button
          onClick={save}
          disabled={saving}
          style={{ width: '100%', padding: '8px', borderRadius: 7, border: 'none', background: saved ? '#22c55e' : '#1a1a1a', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save secrets'}
        </button>
      </div>
    </div>
  );
}

export default function GlobalConfigBar({ globalConfig, onChange, backendAvailable }) {
  const [showSecrets, setShowSecrets] = useState(false);

  return (
    <>
      <div style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #e5e4e0', background: '#fff', flexShrink: 0 }}>
        {/* Backend status dot */}
        <span
          title={backendAvailable ? 'Backend connected' : 'Backend unreachable'}
          style={{ fontSize: 9, color: backendAvailable ? '#22c55e' : '#ef4444', lineHeight: 1, flexShrink: 0 }}
        >
          ●
        </span>

        <span style={{ fontSize: 11, fontWeight: 600, color: '#555', whiteSpace: 'nowrap' }}>LLM</span>
        <datalist id="global-llm-suggestions">
          {LLM_SUGGESTIONS.map(s => <option key={s} value={s} />)}
        </datalist>
        <input
          list="global-llm-suggestions"
          style={{ fontSize: 11, padding: '3px 6px', borderRadius: 5, border: '1px solid #ddd', flex: 1, minWidth: 0 }}
          value={globalConfig.llm}
          onChange={(e) => onChange({ ...globalConfig, llm: e.target.value })}
          placeholder="e.g. gemini-2.5-flash or openai/gpt-4o"
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#555', whiteSpace: 'nowrap', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={globalConfig.human_in_the_loop}
            onChange={(e) => onChange({ ...globalConfig, human_in_the_loop: e.target.checked })}
          />
          Human review
        </label>

        <button
          onClick={() => setShowSecrets(true)}
          title="Manage secrets"
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', borderRadius: 5,
            border: '1px solid #ddd', background: '#fafafa',
            fontSize: 11, color: '#555', cursor: 'pointer', whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f0f0f0'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fafafa'; }}
        >
          🔑 Secrets
        </button>
      </div>

      {showSecrets && <SecretsModal onClose={() => setShowSecrets(false)} />}
    </>
  );
}

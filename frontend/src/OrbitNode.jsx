import { useEffect, useState } from 'react';
import { Handle, Position } from '@xyflow/react';

const TYPE_META = {
  Do:       { icon: '⚡', color: '#2563eb' },
  Navigate: { icon: '→',  color: '#059669' },
  Check:    { icon: '✓',  color: '#d97706' },
  Fill:     { icon: '≡',  color: '#7c3aed' },
  Read:     { icon: '»',  color: '#0891b2' },
  Code:     { icon: '</>', color: '#6b7280' },
  Agent:    { icon: '◈',  color: '#7c3aed' },
  Security: { icon: '🛡️', color: '#dc2626' },
};

const handle = {
  width: 8,
  height: 8,
  background: '#d1d0cc',
  border: '2px solid #fff',
};

function truncate(str, n = 26) {
  if (!str) return null;
  const s = str.trim();
  return s.length > n ? s.slice(0, n) + '…' : s;
}

export default function OrbitNode({ data, selected }) {
  const meta = TYPE_META[data.nodeType] || { icon: '•', color: '#888' };
  const preview = truncate(data.preview);

  // Auto-clear success status after 2 s for green-flash effect
  const [displayStatus, setDisplayStatus] = useState(data.status);
  useEffect(() => {
    if (data.status === 'success') {
      setDisplayStatus('success');
      const t = setTimeout(() => setDisplayStatus(null), 2000);
      return () => clearTimeout(t);
    }
    setDisplayStatus(data.status);
  }, [data.status]);

  const isRunning = displayStatus === 'running';
  const isSuccess = displayStatus === 'success';
  const isError   = displayStatus === 'error';

  let borderColor = selected ? '#1a1a1a' : '#e2e2e2';
  let boxShadow = selected
    ? '0 0 0 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.1)'
    : '0 1px 4px rgba(0,0,0,0.06)';

  if (isSuccess) { borderColor = '#22c55e'; boxShadow = '0 0 0 2.5px #22c55e'; }
  if (isError)   { borderColor = '#ef4444'; boxShadow = '0 0 0 2.5px #ef4444'; }

  return (
    <div
      className={isRunning ? 'node-running' : undefined}
      style={{
        '--node-color': meta.color,
        width: 160,
        borderRadius: 12,
        background: '#fff',
        border: `1.5px solid ${borderColor}`,
        boxShadow,
        padding: '14px 12px 12px',
        textAlign: 'center',
        position: 'relative',
      }}
    >
      <Handle type="target" position={Position.Top} id="handle-in" style={handle} />

      {/* Status badge */}
      {isRunning && (
        <div style={{
          position: 'absolute', top: -5, right: -5,
          width: 12, height: 12, borderRadius: '50%',
          background: meta.color, border: '2px solid #fff',
        }} />
      )}
      {isSuccess && (
        <div style={{
          position: 'absolute', top: -5, right: -5,
          width: 14, height: 14, borderRadius: '50%',
          background: '#22c55e', border: '2px solid #fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 8, color: '#fff', fontWeight: 700,
        }}>✓</div>
      )}
      {isError && (
        <div style={{
          position: 'absolute', top: -5, right: -5,
          width: 14, height: 14, borderRadius: '50%',
          background: '#ef4444', border: '2px solid #fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, color: '#fff', fontWeight: 700,
        }}>!</div>
      )}

      {/* Icon badge */}
      <div style={{
        width: 40, height: 40,
        borderRadius: 10,
        background: `${meta.color}12`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 10px',
        fontSize: data.nodeType === 'Code' ? 13 : 18,
        color: meta.color,
        fontWeight: 700,
      }}>
        {meta.icon}
      </div>

      {/* Label */}
      <div style={{ fontWeight: 600, fontSize: 12, color: '#1a1a1a', lineHeight: 1.3 }}>
        {data.label || data.nodeType}
      </div>

      {/* Config preview */}
      {preview && (
        <div style={{
          marginTop: 4,
          fontSize: 10,
          color: '#9ca3af',
          lineHeight: 1.3,
          fontFamily: data.nodeType === 'Code' ? 'Consolas, monospace' : 'inherit',
        }}>
          {preview}
        </div>
      )}

      {data.nodeType === 'Check' && (
        <>
          <Handle type="source" position={Position.Right} id="true"
            style={{ ...handle, top: '50%', background: '#4ade80', width: 10, height: 10 }} />
          <Handle type="source" position={Position.Left} id="false"
            style={{ ...handle, top: '50%', background: '#f87171', width: 10, height: 10 }} />
        </>
      )}

      <Handle type="source" position={Position.Bottom} id="handle-out" style={handle} />

      {data.nodeType === 'ForEach' && (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="handle-foreach-done"
            style={{ ...handle, left: '75%', background: '#94a3b8', width: 10, height: 10 }}
            title="After loop (done)"
          />
          <div style={{
            position: 'absolute', bottom: -18, left: '75%', transform: 'translateX(-50%)',
            fontSize: 9, color: '#94a3b8', whiteSpace: 'nowrap', pointerEvents: 'none',
          }}>done</div>
        </>
      )}
    </div>
  );
}

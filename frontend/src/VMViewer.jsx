import { useEffect, useRef, useState } from 'react';

export default function VMViewer({ onConnect, viewOnly = true }) {
  const containerRef = useRef(null);
  const rfbRef = useRef(null);
  const [status, setStatus] = useState('Connecting...');

  useEffect(() => {
    const initViaModule = async () => {
      try {
        const { default: RFB } = await import(
          'https://cdn.jsdelivr.net/npm/@novnc/novnc@1.4.0/core/rfb.js'
        );

        if (!containerRef.current) return;

        rfbRef.current = new RFB(containerRef.current, 'ws://localhost:6080', {
          credentials: { password: '' },
        });

        rfbRef.current.viewOnly = viewOnly;
        rfbRef.current.scaleViewport = true;
        rfbRef.current.clipViewport = true;
        rfbRef.current.showDotCursor = true;

        rfbRef.current.addEventListener('connect', () => {
          setStatus('Connected');
          onConnect?.();
        });
        rfbRef.current.addEventListener('disconnect', (e) =>
          setStatus(`Disconnected: ${e.detail?.reason || 'unknown reason'}`)
        );
        rfbRef.current.addEventListener('credentialsrequired', () =>
          setStatus('Credentials required')
        );
      } catch (err) {
        setStatus(`Error: ${err.message}`);
      }
    };

    initViaModule();

    return () => {
      rfbRef.current?.disconnect();
    };
  }, []);

  // Update viewOnly whenever the prop changes
  useEffect(() => {
    if (rfbRef.current) {
      rfbRef.current.viewOnly = viewOnly;
    }
  }, [viewOnly]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#111' }}>
      <div style={{
        padding: '3px 10px',
        background: '#111',
        color: status.startsWith('Connected') ? '#22c55e' : '#666',
        fontSize: '10px',
        fontFamily: 'monospace',
        flexShrink: 0,
      }}>
        Status: {status}
      </div>
      <div ref={containerRef} style={{ flex: 1, width: '100%', height: '100%' }} />
    </div>
  );
}

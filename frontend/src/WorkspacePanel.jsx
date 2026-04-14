import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadGraph, saveGraph, generateWorkflow, previewWorkflow, listWorkflows, createWorkflow, deleteWorkflow, renameWorkflow, listRuns, getRunLog, listFiles, uploadFile, downloadFile, deleteFile } from './useWorkflowApi';
import GlobalConfigBar from './GlobalConfigBar';
import WorkflowSelector from './WorkflowSelector';
import WorkspaceToolbar from './WorkspaceToolbar';
import GraphBuilder from './GraphBuilder';
import NodeConfigPanel from './NodeConfigPanel';

const DEFAULT_GRAPH = {
  version: '1',
  global: {
    llm: 'gemini-3-flash-preview',
    human_in_the_loop: false,
  },
  nodes: [],
  edges: [],
};

const TYPE_CONFIG = {
  Navigate: { target: '', max_steps: null, extra_info: '', llm: null },
  Do: { task: '', max_steps: null, extra_info: '', llm: null },
  Check: { condition: '', max_steps: null, llm: null },
  Fill: { target: '', data: {}, llm: null },
  Read: { task: '', max_steps: null, llm: null },
  Code: { code: '', llm: null },
  Agent: { class_name: '', task: '', prompt_template: '', max_steps: 20, llm: null },
  ForEach: { items_expr: '', loop_var: 'item', llm: null },
};

function createNode(type) {
  return {
    id: `n${Date.now()}`,
    type,
    label: `${type} node`,
    position: { x: 80 + Math.random() * 180, y: 80 + Math.random() * 120 },
    config: TYPE_CONFIG[type] || {},
    output_schema: null,
  };
}

function timeAgo(ts) {
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function fmtDuration(started, finished) {
  if (!finished) return '…';
  const s = Math.round(finished - started);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function fmtSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const STATUS_DOT = { success: '#22c55e', error: '#ef4444', stopped: '#f59e0b', running: '#3b82f6' };

export default function WorkspacePanel({ onStart, onWorkflowEnd }) {
  const [graph, setGraph] = useState(DEFAULT_GRAPH);
  const [workflows, setWorkflows] = useState([]);
  const [currentWorkflowId, setCurrentWorkflowId] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [previewCode, setPreviewCode] = useState('No preview loaded yet.');
  const [status, setStatus] = useState('Loading workflow...');
  const [loading, setLoading] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(true);
  const [nodeStatuses, setNodeStatuses] = useState({});
  const [bottomTab, setBottomTab] = useState('preview');
  const [runs, setRuns] = useState([]);
  const [logModal, setLogModal] = useState(null); // {runId, content}
  const [filePath, setFilePath] = useState('');
  const [fileEntries, setFileEntries] = useState([]);
  const autosaveTimer = useRef(null);
  const esRef = useRef(null);
  const logScrollRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Initialization ────────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;
    async function init() {
      // Retry for up to 90 seconds — backend inside the VM takes time to start
      const MAX_RETRIES = 30;
      const RETRY_DELAY = 3000;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        if (!mounted) return;
        try {
          let wlist = await listWorkflows();
          if (!mounted) return;
          setBackendAvailable(true);

          // First boot — seed a default workflow so currentWorkflowId is never null
          if (wlist.length === 0) {
            await createWorkflow('Untitled');
            wlist = await listWorkflows();
          }
          setWorkflows(wlist);

          const data = await loadGraph(wlist[0].id);
          if (!mounted) return;
          setCurrentWorkflowId(data.id);
          setGraph(data.graph || DEFAULT_GRAPH);
          setStatus('Workflow graph loaded.');
          if (mounted) setLoading(false);
          return;
        } catch {
          if (attempt < MAX_RETRIES - 1) {
            setStatus(`Waiting for backend… (${attempt + 1}/${MAX_RETRIES})`);
            await new Promise(r => setTimeout(r, RETRY_DELAY));
          } else {
            setStatus('Backend unreachable. Is the container running?');
            setBackendAvailable(false);
            if (mounted) setLoading(false);
          }
        }
      }
    }
    init();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!loading) fetchPreview();
  }, [loading]);

  // ── Workflow selector actions ─────────────────────────────────────────────

  const handleWorkflowSelect = async (id) => {
    if (id === currentWorkflowId) return;
    // Save current first
    if (currentWorkflowId) {
      await saveGraph(currentWorkflowId, graph).catch(() => {});
    }
    try {
      const data = await loadGraph(id);
      setCurrentWorkflowId(data.id);
      setGraph(data.graph || DEFAULT_GRAPH);
      setSelectedNodeId(null);
      setStatus('Workflow loaded.');
      setNodeStatuses({});
      fetchRuns(data.id);
    } catch {
      setStatus('Failed to load workflow.');
    }
  };

  const handleWorkflowCreate = async () => {
    try {
      const created = await createWorkflow('Untitled');
      const wlist = await listWorkflows();
      setWorkflows(wlist);
      // Switch to new workflow
      setCurrentWorkflowId(created.id);
      setGraph(DEFAULT_GRAPH);
      setSelectedNodeId(null);
      setStatus('New workflow created.');
      setNodeStatuses({});
    } catch {
      setStatus('Failed to create workflow.');
    }
  };

  const handleWorkflowDelete = async (id) => {
    try {
      await deleteWorkflow(id);
      const wlist = await listWorkflows();
      setWorkflows(wlist);
      // Switch to first remaining
      if (wlist.length > 0) {
        const data = await loadGraph(wlist[0].id);
        setCurrentWorkflowId(data.id);
        setGraph(data.graph || DEFAULT_GRAPH);
        setSelectedNodeId(null);
        setStatus('Workflow deleted.');
      }
    } catch {
      setStatus('Failed to delete workflow.');
    }
  };

  const handleWorkflowRename = async (id, name) => {
    try {
      await renameWorkflow(id, name);
      setWorkflows(prev => prev.map(w => w.id === id ? { ...w, name } : w));
    } catch {
      setStatus('Failed to rename workflow.');
    }
  };

  // ── Node / graph actions ──────────────────────────────────────────────────

  const selectedNode = useMemo(
    () => graph.nodes.find((node) => node.id === selectedNodeId) || null,
    [graph.nodes, selectedNodeId]
  );

  const updateNode = (updatedNode) => {
    setGraph((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === updatedNode.id ? updatedNode : node)),
    }));
  };

  const deleteNode = (nodeId) => {
    setGraph((current) => ({
      ...current,
      nodes: current.nodes.filter((n) => n.id !== nodeId),
      edges: current.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    }));
    setSelectedNodeId(null);
  };

  const handleEdgeDelete = (edgeId) => {
    setGraph((current) => ({
      ...current,
      edges: current.edges.filter((e) => e.id !== edgeId),
    }));
  };

  const handleGlobalChange = (newGlobal) => {
    setGraph((current) => ({ ...current, global: newGlobal }));
  };

  const handleNodesChange = (nodes) => {
    setGraph((current) => {
      const next = { ...current, nodes };
      if (backendAvailable && currentWorkflowId) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = setTimeout(() => {
          saveGraph(currentWorkflowId, next).catch(() => {});
        }, 1000);
      }
      return next;
    });
  };

  const handleEdgesChange = (edges) => {
    setGraph((current) => ({ ...current, edges }));
  };

  const handleAddNode = (type) => {
    setGraph((current) => ({ ...current, nodes: [...current.nodes, createNode(type)] }));
  };

  // Returns true if adding source→target would create a cycle among sequential edges.
  const _wouldCycle = (edges, source, target) => {
    // BFS: can we reach source from target through existing sequential edges?
    const adj = {};
    for (const e of edges) {
      if (e.type === 'loop_back') continue;
      if (!adj[e.source]) adj[e.source] = [];
      adj[e.source].push(e.target);
    }
    const queue = [target];
    const visited = new Set();
    while (queue.length) {
      const cur = queue.shift();
      if (cur === source) return true;
      if (visited.has(cur)) continue;
      visited.add(cur);
      for (const next of (adj[cur] || [])) queue.push(next);
    }
    return false;
  };

  const handleConnect = async (params) => {
    const sourceNode = graph.nodes.find((node) => node.id === params.source);
    const targetNode = graph.nodes.find((node) => node.id === params.target);
    let edgeType = 'sequential';
    let maxIterations = undefined;

    // Only treat as a back edge when the target is significantly above the source.
    // Horizontal offset is ignored — nodes are often laid out left/right without implying a loop.
    const isBackEdge = sourceNode && targetNode &&
      targetNode.position.y + 100 < sourceNode.position.y;

    if (isBackEdge) {
      const raw = window.prompt('Loop back detected. Enter max iterations:', '3');
      const iterations = parseInt(raw, 10);
      if (!raw || Number.isNaN(iterations) || iterations < 1) {
        setStatus('Loop creation canceled. Provide a positive integer.');
        return;
      }
      edgeType = 'loop_back';
      maxIterations = iterations;
    } else if (params.sourceHandle === 'true') {
      edgeType = 'conditional_true';
    } else if (params.sourceHandle === 'false') {
      edgeType = 'conditional_false';
    }

    // Reject sequential edges that would create a cycle — catch it at draw time, not generate time.
    if (edgeType !== 'loop_back' && _wouldCycle(graph.edges, params.source, params.target)) {
      setStatus('❌ This connection would create a cycle. Draw the edge upward to create a retry loop instead.');
      return;
    }

    const newEdge = {
      id: `e${Date.now()}`,
      source: params.source,
      target: params.target,
      type: edgeType,
      sourceHandle: params.sourceHandle || 'handle-out',
      targetHandle: params.targetHandle || 'handle-in',
      ...(edgeType === 'loop_back' ? { max_iterations: maxIterations } : {}),
    };

    setGraph((current) => ({ ...current, edges: [...current.edges, newEdge] }));
  };

  // ── Toolbar actions ───────────────────────────────────────────────────────

  const saveCurrentGraph = async () => {
    if (!currentWorkflowId) return;
    try {
      await saveGraph(currentWorkflowId, graph);
      setStatus('Workflow graph saved.');
      setBackendAvailable(true);
    } catch {
      setStatus('Failed to save workflow graph. Check backend and refresh.');
      setBackendAvailable(false);
    }
  };

  const generateCurrentWorkflow = async () => {
    if (!currentWorkflowId) {
      setStatus('No workflow selected.');
      return;
    }
    try {
      await saveGraph(currentWorkflowId, graph);
      const result = await generateWorkflow(currentWorkflowId);
      if (result.status === 'generated') {
        setStatus('Workflow generated successfully.');
      } else {
        setStatus(result.message || 'Generation failed.');
      }
      await fetchPreview();
    } catch (err) {
      setStatus(err.message);
    }
  };

  const handleRun = useCallback(async () => {
    setNodeStatuses({});
    await onStart(currentWorkflowId);
    esRef.current?.close();
    const es = new EventSource('http://localhost:8000/events');
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'reset') {
        setNodeStatuses({});
      } else if (data.type === 'snapshot') {
        setNodeStatuses(data.statuses || {});
      } else if (data.node_id === '__workflow__') {
        const terminal = data.status === 'success' || data.status === 'error' || data.status === 'stopped';
        if (terminal) { es.close(); onWorkflowEnd?.(data.status); fetchRuns(currentWorkflowId); }
      } else if (data.node_id) {
        setNodeStatuses(prev => ({ ...prev, [data.node_id]: data.status }));
      }
    };
    es.onerror = () => { es.close(); };
    esRef.current = es;
  }, [onStart, currentWorkflowId]);

  useEffect(() => () => esRef.current?.close(), []);

  const fetchPreview = async () => {
    try {
      const result = await previewWorkflow();
      setPreviewCode(result.code || 'No workflow.py available.');
      setBackendAvailable(true);
    } catch {
      setPreviewCode('Backend unavailable. Cannot load preview.');
      setBackendAvailable(false);
    }
  };

  const fetchRuns = useCallback(async (wfId) => {
    if (!wfId) return;
    try {
      setRuns(await listRuns(wfId));
    } catch {
      // silently ignore
    }
  }, []);

  const fetchFiles = useCallback(async (path = '') => {
    try {
      const { entries } = await listFiles(path);
      setFileEntries(entries);
      setFilePath(path);
    } catch { /* ignore */ }
  }, []);

  const openLog = async (runId) => {
    try {
      const content = await getRunLog(runId);
      setLogModal({ runId, content });
    } catch {
      setLogModal({ runId, content: 'Log not available.' });
    }
  };

  // Live-poll log every 2s while modal is open
  useEffect(() => {
    if (!logModal?.runId) return;
    const iv = setInterval(async () => {
      try {
        const content = await getRunLog(logModal.runId);
        setLogModal(prev => prev ? { ...prev, content } : null);
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(iv);
  }, [logModal?.runId]);

  // Auto-scroll to bottom whenever log content changes
  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [logModal?.content]);

  if (loading) {
    return <div style={{ padding: 20, color: '#555', fontSize: 13 }}>Loading workflow builder...</div>;
  }

  return (
    <div className="workspace-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <WorkflowSelector
        workflows={workflows}
        currentId={currentWorkflowId}
        onSelect={handleWorkflowSelect}
        onCreate={handleWorkflowCreate}
        onDelete={handleWorkflowDelete}
        onRename={handleWorkflowRename}
      />
      <GlobalConfigBar globalConfig={graph.global} onChange={handleGlobalChange} backendAvailable={backendAvailable} />
      <WorkspaceToolbar
        onAddNode={handleAddNode}
        onSave={saveCurrentGraph}
        onGenerate={generateCurrentWorkflow}
        onPreview={fetchPreview}
        onStart={handleRun}
        status={status}
        disabled={!backendAvailable}
      />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {selectedNode ? (
          <div style={{ flex: 1, overflow: 'auto' }}>
            <NodeConfigPanel node={selectedNode} onUpdate={updateNode} onClose={() => setSelectedNodeId(null)} onDelete={deleteNode} />
          </div>
        ) : (
          <>
            <div style={{ flex: 1, minHeight: 0, padding: '0 8px 4px' }}>
              <GraphBuilder
                graph={graph}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={handleConnect}
                onSelectNode={setSelectedNodeId}
                onEdgeDelete={handleEdgeDelete}
                selectedNodeId={selectedNodeId}
                nodeStatuses={nodeStatuses}
              />
            </div>
            <div style={{ flex: `0 0 ${bottomTab === 'files' ? 320 : 160}px`, margin: '0 8px 8px', background: '#0d1117', borderRadius: 10, border: '1px solid #30363d', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* Tab bar */}
              <div style={{ padding: '0 8px', background: '#161b22', borderBottom: '1px solid #30363d', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, minHeight: 30 }}>
                {['preview', 'runs', 'files'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => {
                      setBottomTab(tab);
                      if (tab === 'runs') fetchRuns(currentWorkflowId);
                      if (tab === 'files') fetchFiles('');
                    }}
                    style={{
                      fontSize: 12, padding: '4px 10px', background: 'none', border: 'none', cursor: 'pointer',
                      color: bottomTab === tab ? '#e6edf3' : '#8b949e',
                      borderBottom: bottomTab === tab ? '2px solid #58a6ff' : '2px solid transparent',
                      fontFamily: 'Consolas, monospace',
                      fontWeight: bottomTab === tab ? 600 : 400,
                    }}
                  >
                    {tab === 'preview' ? 'workflow.py' : tab === 'runs' ? 'Runs' : 'Files'}
                  </button>
                ))}
                {bottomTab === 'preview' && (
                  <button
                    onClick={() => navigator.clipboard.writeText(previewCode)}
                    style={{ marginLeft: 'auto', fontSize: 11, color: '#8b949e', background: 'none', border: '1px solid #30363d', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}
                  >
                    Copy
                  </button>
                )}
              </div>

              {/* Tab content */}
              {bottomTab === 'preview' ? (
                <pre style={{ fontSize: 10, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#e6edf3', margin: 0, padding: '6px 10px', fontFamily: 'Consolas, monospace', overflow: 'auto', flex: 1 }}>
                  {previewCode}
                </pre>
              ) : bottomTab === 'runs' ? (
                <div style={{ overflow: 'auto', flex: 1, padding: '4px 0' }}>
                  {runs.length === 0 ? (
                    <div style={{ fontSize: 11, color: '#8b949e', padding: '12px 12px', textAlign: 'center' }}>No runs yet.</div>
                  ) : runs.map(run => (
                    <div
                      key={run.id}
                      onClick={() => openLog(run.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', cursor: 'pointer', borderRadius: 4 }}
                      onMouseEnter={e => e.currentTarget.style.background = '#161b22'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontSize: 10, color: STATUS_DOT[run.status] || '#8b949e' }}>●</span>
                      <span style={{ fontSize: 10, color: '#e6edf3', flex: 1, fontFamily: 'Consolas, monospace' }}>{run.status}</span>
                      <span style={{ fontSize: 10, color: '#8b949e' }}>{timeAgo(run.started_at)}</span>
                      <span style={{ fontSize: 10, color: '#8b949e', minWidth: 36, textAlign: 'right' }}>{fmtDuration(run.started_at, run.finished_at)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                /* Files tab */
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                  {/* Breadcrumb + upload */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderBottom: '1px solid #30363d', flexShrink: 0, flexWrap: 'wrap' }}>
                    <span
                      style={{ fontSize: 11, color: '#58a6ff', cursor: 'pointer', fontFamily: 'Consolas, monospace' }}
                      onClick={() => fetchFiles('')}
                    >/workspace</span>
                    {filePath && filePath.split('/').filter(Boolean).map((seg, i, arr) => (
                      <span key={i} style={{ fontSize: 11, fontFamily: 'Consolas, monospace', color: '#8b949e' }}>
                        {'/'}
                        <span
                          style={{ color: '#58a6ff', cursor: 'pointer' }}
                          onClick={() => fetchFiles(arr.slice(0, i + 1).join('/'))}
                        >{seg}</span>
                      </span>
                    ))}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        style={{ fontSize: 11, padding: '2px 8px', background: '#238636', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                      >Upload</button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          for (const f of e.target.files) {
                            await uploadFile(filePath, f).catch(() => {});
                          }
                          fetchFiles(filePath);
                          e.target.value = '';
                        }}
                      />
                    </div>
                  </div>
                  {/* File list */}
                  <div style={{ overflow: 'auto', flex: 1 }}>
                    {fileEntries.length === 0 ? (
                      <div style={{ fontSize: 11, color: '#8b949e', padding: '12px', textAlign: 'center' }}>Empty directory.</div>
                    ) : fileEntries.map(entry => (
                      <div
                        key={entry.path}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', cursor: entry.is_dir ? 'pointer' : 'default' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#161b22'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        onClick={() => entry.is_dir && fetchFiles(entry.path)}
                      >
                        <span style={{ fontSize: 11 }}>{entry.is_dir ? '📁' : '📄'}</span>
                        <span style={{ fontSize: 11, color: '#e6edf3', flex: 1, fontFamily: 'Consolas, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
                        {!entry.is_dir && (
                          <>
                            <span style={{ fontSize: 10, color: '#8b949e', flexShrink: 0 }}>{fmtSize(entry.size)}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); downloadFile(entry.path); }}
                              style={{ fontSize: 10, padding: '1px 6px', background: 'none', border: '1px solid #30363d', borderRadius: 3, color: '#8b949e', cursor: 'pointer', flexShrink: 0 }}
                            >↓</button>
                          </>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteFile(entry.path).then(() => fetchFiles(filePath)).catch(() => {}); }}
                          style={{ fontSize: 10, padding: '1px 6px', background: 'none', border: '1px solid #30363d', borderRadius: 3, color: '#8b949e', cursor: 'pointer', flexShrink: 0 }}
                        >×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Log modal */}
            {logModal && (
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => setLogModal(null)}
              >
                <div
                  style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 10, width: '70vw', maxHeight: '70vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                  onClick={e => e.stopPropagation()}
                >
                  <div style={{ padding: '8px 14px', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#8b949e', fontFamily: 'Consolas, monospace' }}>run log — {logModal.runId.slice(0, 8)}…</span>
                    <button onClick={() => setLogModal(null)} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: 16 }}>×</button>
                  </div>
                  <pre ref={logScrollRef} style={{ fontSize: 10, lineHeight: 1.6, color: '#e6edf3', margin: 0, padding: '10px 14px', fontFamily: 'Consolas, monospace', overflow: 'auto', flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {logModal.content}
                  </pre>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

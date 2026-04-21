const s = {
  root: {
    height: '100%',
    overflowY: 'auto',
    background: '#fff',
    display: 'flex',
    justifyContent: 'center',
  },
  page: {
    maxWidth: 740,
    width: '100%',
    padding: '48px 40px 80px',
    fontFamily: "'Geist', sans-serif",
    color: '#1a1a1a',
    lineHeight: 1.6,
  },
  h1: { fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 6 },
  lead: { fontSize: 14, color: '#666', marginBottom: 48 },
  h2: { fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px', marginTop: 48, marginBottom: 12 },
  h3: { fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#888', marginTop: 28, marginBottom: 8 },
  p: { fontSize: 13.5, color: '#333', marginBottom: 10 },
  hr: { border: 'none', borderTop: '1px solid #f0f0f0', margin: '40px 0' },
  ul: { paddingLeft: 18, marginBottom: 10 },
  li: { fontSize: 13.5, color: '#333', marginBottom: 5 },
  code: {
    fontFamily: "'Geist Mono', monospace",
    fontSize: 12,
    background: '#f4f3f0',
    padding: '1px 5px',
    borderRadius: 4,
    color: '#1a1a1a',
  },
  pre: {
    fontFamily: "'Geist Mono', monospace",
    fontSize: 12,
    background: '#f4f3f0',
    padding: '14px 16px',
    borderRadius: 7,
    overflowX: 'auto',
    marginBottom: 12,
    lineHeight: 1.7,
    color: '#1a1a1a',
  },
  tip: {
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: 7,
    padding: '10px 14px',
    fontSize: 13,
    color: '#166534',
    marginBottom: 12,
  },
  warn: {
    background: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: 7,
    padding: '10px 14px',
    fontSize: 13,
    color: '#92400e',
    marginBottom: 12,
  },
  nodeGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
    marginBottom: 16,
  },
  nodeCard: {
    border: '1px solid #e5e4e0',
    borderRadius: 8,
    padding: '12px 14px',
  },
  nodeLabel: { fontSize: 13, fontWeight: 700, marginBottom: 3 },
  nodeDesc: { fontSize: 12, color: '#666', lineHeight: 1.5 },
  badge: {
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: 4,
    marginRight: 5,
    verticalAlign: 'middle',
  },
};

const C = ({ children }) => <code style={s.code}>{children}</code>;

const NodeCard = ({ icon, name, color, children }) => (
  <div style={s.nodeCard}>
    <div style={s.nodeLabel}>
      <span style={{ ...s.badge, background: color + '18', color }}>{icon}</span>
      {name}
    </div>
    <div style={s.nodeDesc}>{children}</div>
  </div>
);

const EdgeRow = ({ color, label, children }) => (
  <div style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
    <span style={{
      flexShrink: 0, marginTop: 3,
      display: 'inline-block', width: 28, height: 3,
      background: color, borderRadius: 2,
    }} />
    <div>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label} — </span>
      <span style={{ fontSize: 13, color: '#555' }}>{children}</span>
    </div>
  </div>
);

export default function DocsPanel() {
  return (
    <div style={s.root}>
      <div style={s.page}>

        <h1 style={s.h1}>Orbit Studio</h1>
        <p style={s.lead}>Build desktop automation workflows visually. Connect nodes, run the agent, watch it work.</p>

        {/* ── QUICK START ─────────────────────────────────── */}
        <h2 style={s.h2}>Quick start</h2>

        <div style={{ counterReset: 'step' }}>
          {[
            ['Add your API key', <>Open <strong>Secrets</strong> (key icon in the top bar). Add your LLM key — e.g. key <C>GEMINI_API_KEY</C>, value from Google AI Studio. The global model defaults to <C>gemini-3-flash-preview</C>; change it in the top bar.</>],
            ['Create a workflow', <>Click <strong>+ New</strong> in the workflow selector (top-left of the right panel).</>],
            ['Add nodes', <>Use the toolbar buttons to add nodes. Drag them on the canvas to arrange.</>],
            ['Connect nodes', <>Drag from the bottom handle of one node to the top handle of the next. This creates a sequential edge.</>],
            ['Run', <>Click <strong>▶ Run</strong>. The agent starts executing in the VM on the left. Node borders pulse green as they complete.</>],
          ].map(([title, body], i) => (
            <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
              <div style={{
                flexShrink: 0, width: 26, height: 26, borderRadius: 7,
                background: '#1a1a1a', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, marginTop: 1,
              }}>{i + 1}</div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: 13, color: '#555' }}>{body}</div>
              </div>
            </div>
          ))}
        </div>

        <hr style={s.hr} />

        {/* ── NODES ───────────────────────────────────────── */}
        <h2 style={s.h2}>Nodes</h2>
        <p style={s.p}>Each node is one step in your workflow. Click a node to configure it in the right panel.</p>

        <div style={s.nodeGrid}>
          <NodeCard icon="→" name="Navigate" color="#059669">
            Open a URL in the browser. Use this to start any web task.
          </NodeCard>
          <NodeCard icon="⚡" name="Do" color="#2563eb">
            Describe an action in plain English. The agent figures out the clicks and keystrokes.
          </NodeCard>
          <NodeCard icon="»" name="Read" color="#0891b2">
            Extract data from the screen. Define an <strong>Output Schema</strong> to get structured results you can pipe to later nodes.
          </NodeCard>
          <NodeCard icon="≡" name="Fill" color="#7c3aed">
            Fill a form. Specify the form target and a field → value map.
          </NodeCard>
          <NodeCard icon="✓" name="Check" color="#d97706">
            Ask a yes/no question. Branches into <strong>true</strong> (right handle, green) and <strong>false</strong> (left handle, red) paths.
          </NodeCard>
          <NodeCard icon="</>" name="Code" color="#6b7280">
            Run raw Python. Executes inline — has access to all workflow variables. Use for data processing between agent steps.
          </NodeCard>
          <NodeCard icon="↺" name="ForEach" color="#0ea5e9">
            Iterate over a list. Connect body nodes to the bottom handle. Connect the node that runs <em>after</em> the loop to the <strong>done</strong> handle (bottom-right).
          </NodeCard>
          <NodeCard icon="◈" name="Agent" color="#7c3aed">
            A custom verb with your own prompt template. Subclasses <C>BaseActionAgent</C> — use when the built-in verbs aren't expressive enough.
          </NodeCard>
        </div>

        <hr style={s.hr} />

        {/* ── CONNECTIONS ─────────────────────────────────── */}
        <h2 style={s.h2}>Connections</h2>
        <p style={s.p}>Draw edges by dragging from one node's handle to another. The edge type is inferred from the handle you start from.</p>

        <EdgeRow color="#c0bdb8" label="Sequential">Normal execution order. Drag from the bottom handle of any node.</EdgeRow>
        <EdgeRow color="#4ade80" label="Conditional true">From a Check node's right (green) handle. The path taken when the condition is true.</EdgeRow>
        <EdgeRow color="#f87171" label="Conditional false">From a Check node's left (red) handle. The path taken when the condition is false.</EdgeRow>
        <EdgeRow color="#f59e0b" label="Loop back (retry)">Draw an edge <em>upward</em> from a lower node to a higher one. You'll be prompted for max iterations. The loop retries until the Check at the header passes.</EdgeRow>
        <EdgeRow color="#94a3b8" label="ForEach done">From a ForEach node's <strong>done</strong> handle (bottom-right). Connects to whatever runs after the loop finishes.</EdgeRow>

        <div style={{ ...s.tip, marginTop: 16 }}>
          <strong>Tip:</strong> To delete an edge, hover over it and click the × button that appears at its midpoint.
        </div>

        <hr style={s.hr} />

        {/* ── DATA PASSING ─────────────────────────────────── */}
        <h2 style={s.h2}>Passing data between nodes</h2>

        <p style={s.p}>
          Add an <strong>Output Schema</strong> to a Read, Do, or Agent node to capture structured output. Then reference it downstream using <C>{'{{node_id.field_name}}'}</C>.
        </p>

        <pre style={s.pre}>{`# Example: Read node with id "n1234" extracts { company: str, url: str }
# A downstream Navigate node can use:
target = "{{n1234.url}}"

# A Do node task can use:
task = "Apply to {{n1234.company}} — click the Apply button"`}</pre>

        <p style={s.p}>Inside a <strong>ForEach</strong> loop, reference the current item as <C>{'{{item}}'}</C> (or whatever loop variable name you set).</p>

        <pre style={s.pre}>{`# ForEach with loop_var = "job"
# Downstream Do node:
task = "Click Apply for {{job}}"`}</pre>

        <hr style={s.hr} />

        {/* ── SECRETS ──────────────────────────────────────── */}
        <h2 style={s.h2}>Secrets</h2>

        <p style={s.p}>
          Store API keys and credentials in the <strong>Secrets</strong> vault (key icon in the global config bar). They are loaded as environment variables at runtime.
        </p>
        <p style={s.p}>Reference them anywhere in node config using:</p>

        <pre style={s.pre}>{`{{secrets.MY_API_KEY}}`}</pre>

        <p style={s.p}>For example, in a Fill node's data field:</p>
        <pre style={s.pre}>{`password → {{secrets.LOGIN_PASSWORD}}`}</pre>

        <div style={s.warn}>
          <strong>Note:</strong> Secrets are stored in plaintext in <C>/workspace/orbit.db</C>. Do not expose the workspace volume publicly.
        </div>

        <hr style={s.hr} />

        {/* ── MCP SERVERS ──────────────────────────────────── */}
        <h2 style={s.h2}>MCP servers</h2>

        <p style={s.p}>
          Connect any MCP-compatible tool server to a node. The agent for that node will have the MCP tools available to call.
          Open a node's config panel and scroll to the <strong>MCP Servers</strong> section.
        </p>

        <h3 style={s.h3}>stdio (local process)</h3>
        <pre style={s.pre}>{`Command:  npx
Args:     -y, @modelcontextprotocol/server-filesystem, /workspace`}</pre>

        <h3 style={s.h3}>SSE (remote server)</h3>
        <pre style={s.pre}>{`URL:  http://localhost:9000/sse`}</pre>

        <p style={s.p}>You can attach multiple MCP servers to a single node — they are stacked as nested context managers in the generated code.</p>

        <hr style={s.hr} />

        {/* ── CODE NODE ──────────────────────────────────────── */}
        <h2 style={s.h2}>Code node</h2>

        <p style={s.p}>
          Write any Python. The code runs inline inside the workflow's async context, so you can use <C>await</C> and access all workflow variables directly.
        </p>

        <pre style={s.pre}>{`# Read a CSV into a list of rows (used by a downstream ForEach)
import pandas as pd
rows = pd.read_csv('/workspace/uploads/jobs.csv').to_dict('records')`}</pre>

        <div style={s.tip}>
          <strong>Tip:</strong> Need a package that isn't installed? Add a Code node before your main logic:<br />
          <code style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12 }}>import subprocess, sys{'\n'}subprocess.run([sys.executable, "-m", "pip", "install", "-q", "pandas"], check=True)</code>
        </div>

        <hr style={s.hr} />

        {/* ── ADVANCED ──────────────────────────────────────── */}
        <h2 style={s.h2}>Advanced</h2>

        <h3 style={s.h3}>Per-node LLM override</h3>
        <p style={s.p}>
          The global LLM (set in the top bar) applies to all nodes. Override it per-node in the <strong>Advanced</strong> section of any node's config. Accepts any LiteLLM model string:
        </p>
        <pre style={s.pre}>{`anthropic/claude-3-5-sonnet-20241022
openai/gpt-4o
openrouter/google/gemini-flash-1.5`}</pre>

        <h3 style={s.h3}>Human-in-the-loop</h3>
        <p style={s.p}>
          Enable <strong>Human in the loop</strong> in the top bar to have the agent pause and ask for confirmation before each action. Useful for sensitive workflows. Use <strong>Take Over</strong> in the top-left to manually control the desktop at any point.
        </p>

        <h3 style={s.h3}>Run history & logs</h3>
        <p style={s.p}>
          Click the <strong>Runs</strong> tab at the bottom of the workspace panel to see past runs. Click a run to stream its full log output.
        </p>

        <h3 style={s.h3}>Files</h3>
        <p style={s.p}>
          The <strong>Files</strong> tab gives you access to <C>/workspace</C> — upload CSVs, download outputs, and manage files the agent creates.
        </p>

        <hr style={s.hr} />

        <p style={{ fontSize: 12, color: '#bbb', marginTop: 8 }}>
          orbit-cua — <a href="https://pypi.org/project/orbit-cua/" target="_blank" rel="noreferrer" style={{ color: '#bbb' }}>PyPI</a>
        </p>

      </div>
    </div>
  );
}

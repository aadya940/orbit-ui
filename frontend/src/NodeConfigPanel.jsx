import SchemaEditor from "./SchemaEditor";

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

const styles = {
  panel: {
    padding: 12,
    background: "#fff",
    height: "100%",
    overflowY: "auto",
    fontSize: 12,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: { fontSize: 13, fontWeight: 700, color: "#1a1a1a" },
  badge: {
    fontSize: 10,
    padding: "2px 6px",
    borderRadius: 4,
    fontWeight: 600,
    color: "#fff",
  },
  closeBtn: {
    fontSize: 11,
    padding: "4px 10px",
    border: "1px solid #ddd",
    borderRadius: 4,
    background: "#fff",
    cursor: "pointer",
  },
  fieldGroup: { marginBottom: 10 },
  label: {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "#555",
    marginBottom: 3,
  },
  input: {
    width: "100%",
    fontSize: 12,
    padding: "5px 7px",
    border: "1px solid #ddd",
    borderRadius: 4,
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    fontSize: 12,
    padding: "5px 7px",
    border: "1px solid #ddd",
    borderRadius: 4,
    boxSizing: "border-box",
    minHeight: 60,
    fontFamily: "inherit",
    resize: "vertical",
  },
  codeArea: {
    width: "100%",
    fontSize: 11,
    padding: "5px 7px",
    border: "1px solid #ddd",
    borderRadius: 4,
    boxSizing: "border-box",
    minHeight: 80,
    fontFamily: "Consolas, monospace",
    resize: "vertical",
  },
  select: {
    width: "100%",
    fontSize: 12,
    padding: "5px 7px",
    border: "1px solid #ddd",
    borderRadius: 4,
    boxSizing: "border-box",
  },
  numberInput: {
    width: 70,
    fontSize: 12,
    padding: "5px 7px",
    border: "1px solid #ddd",
    borderRadius: 4,
  },
  kvRow: {
    display: "flex",
    gap: 4,
    marginBottom: 4,
    alignItems: "center",
  },
  kvInput: {
    flex: 1,
    fontSize: 11,
    padding: "3px 5px",
    border: "1px solid #ddd",
    borderRadius: 4,
  },
  kvAddBtn: {
    fontSize: 10,
    padding: "2px 6px",
    border: "1px solid #ccc",
    borderRadius: 4,
    background: "#fff",
    cursor: "pointer",
    marginTop: 4,
  },
  kvRemoveBtn: {
    fontSize: 10,
    padding: "2px 5px",
    border: "none",
    background: "transparent",
    color: "#999",
    cursor: "pointer",
  },
};

const TYPE_COLORS = {
  Do: "#2563eb",
  Navigate: "#059669",
  Check: "#d97706",
  Fill: "#7c3aed",
  Read: "#0891b2",
  Code: "#6b7280",
  Agent: "#7c3aed",
};

const divider = { border: 'none', borderTop: '1px solid #f0f0f0', margin: '10px 0 6px' };
const sectionLabel = { fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#bbb', marginBottom: 6 };

function KeyValueEditor({ data, onChange }) {
  const entries = Object.entries(data || {});

  function update(oldKey, newKey, newVal) {
    const updated = {};
    for (const [k, v] of entries) {
      if (k === oldKey) {
        updated[newKey] = newVal;
      } else {
        updated[k] = v;
      }
    }
    onChange(updated);
  }

  function add() {
    onChange({ ...data, "": "" });
  }

  function remove(key) {
    const updated = { ...data };
    delete updated[key];
    onChange(updated);
  }

  return (
    <div>
      {entries.map(([k, v], i) => (
        <div key={i} style={styles.kvRow}>
          <input
            style={styles.kvInput}
            placeholder="field label"
            value={k}
            onChange={(e) => update(k, e.target.value, v)}
          />
          <input
            style={styles.kvInput}
            placeholder="value"
            value={v}
            onChange={(e) => update(k, k, e.target.value)}
          />
          <button style={styles.kvRemoveBtn} onClick={() => remove(k)}>
            x
          </button>
        </div>
      ))}
      <button style={styles.kvAddBtn} onClick={add}>
        + Field
      </button>
    </div>
  );
}

function McpServersEditor({ servers, onChange }) {
  function addServer() {
    onChange([...servers, { transport: 'stdio', command: '', args: [], url: '' }]);
  }
  function removeServer(i) {
    onChange(servers.filter((_, idx) => idx !== i));
  }
  function updateServer(i, patch) {
    onChange(servers.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  }
  function updateArgs(i, rawText) {
    // Split comma-separated args
    const args = rawText.split(',').map(a => a.trim()).filter(Boolean);
    updateServer(i, { args });
  }

  return (
    <>
      <hr style={divider} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={sectionLabel}>MCP SERVERS</div>
        <button style={styles.kvAddBtn} onClick={addServer}>+ Add</button>
      </div>
      {servers.length === 0 && (
        <div style={{ fontSize: 10, color: '#bbb', marginBottom: 6 }}>No MCP servers. Click + Add to connect one.</div>
      )}
      {servers.map((srv, i) => (
        <div key={i} style={{ border: '1px solid #f0f0f0', borderRadius: 5, padding: '7px 8px', marginBottom: 7, background: '#fafafa' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <select
              style={{ ...styles.select, width: 90, padding: '3px 5px', fontSize: 11 }}
              value={srv.transport}
              onChange={e => updateServer(i, { transport: e.target.value })}
            >
              <option value="stdio">stdio</option>
              <option value="sse">SSE</option>
            </select>
            <button style={{ ...styles.kvRemoveBtn, fontSize: 12 }} onClick={() => removeServer(i)}>×</button>
          </div>
          {srv.transport === 'stdio' ? (
            <>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Command</label>
                <input style={styles.input} value={srv.command || ''} placeholder="e.g. npx" onChange={e => updateServer(i, { command: e.target.value })} />
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Args (comma-separated)</label>
                <input style={styles.input} value={(srv.args || []).join(', ')} placeholder="-y, @modelcontextprotocol/server-filesystem, /workspace" onChange={e => updateArgs(i, e.target.value)} />
              </div>
            </>
          ) : (
            <div style={styles.fieldGroup}>
              <label style={styles.label}>URL</label>
              <input style={styles.input} value={srv.url || ''} placeholder="http://localhost:8000/sse" onChange={e => updateServer(i, { url: e.target.value })} />
            </div>
          )}
        </div>
      ))}
    </>
  );
}

export default function NodeConfigPanel({ node, onUpdate, onClose, onDelete }) {
  if (!node) return null;

  // Handle both the raw backend node format (node.type) and the frontend format
  const nodeType = node.type || node.data?.nodeType;
  const config = node.config || node.data?.config || {};
  const schemaFields = (node.output_schema || node.data?.output_schema)?.fields || [];

  function updateConfig(key, value) {
    onUpdate({
      ...node,
      config: { ...config, [key]: value },
    });
  }

  function updateSchema(fields) {
    onUpdate({
      ...node,
      output_schema: fields.length > 0 ? { fields } : null,
    });
  }

  function updateLabel(label) {
    onUpdate({ ...node, label });
  }

  const showSchema = nodeType === "Read" || nodeType === "Do" || nodeType === "Agent";
  const showMaxSteps = nodeType !== "Code" && nodeType !== "ForEach";
  const showExtraInfo = nodeType === "Do" || nodeType === "Navigate";

  return (
    <div style={styles.panel}>
      {/* Header: type badge + Done */}
      <div style={styles.header}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ ...styles.badge, background: TYPE_COLORS[nodeType] || "#888", alignSelf: 'flex-start' }}>
            {nodeType}
          </span>
          <span
            title="Use this ID to reference this node's output: {{node_id.field}}"
            style={{ fontSize: 9, color: '#bbb', fontFamily: 'monospace', cursor: 'default', userSelect: 'all' }}
          >
            {node.id}
          </span>
        </div>
        <button style={styles.closeBtn} onClick={onClose}>Done</button>
      </div>

      {/* Label */}
      <div style={styles.fieldGroup}>
        <label style={styles.label}>Label</label>
        <input style={styles.input} value={node.label || ""} onChange={(e) => updateLabel(e.target.value)} />
      </div>

      <hr style={divider} />
      <div style={sectionLabel}>CONFIGURATION</div>

      {/* Type-specific fields */}
      {nodeType === "Navigate" && (
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Target URL</label>
          <input style={styles.input} value={config.target || ""} onChange={(e) => updateConfig("target", e.target.value)} placeholder="https://..." />
        </div>
      )}
      {nodeType === "Do" && (
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Task</label>
          <textarea style={styles.textarea} value={config.task || ""} onChange={(e) => updateConfig("task", e.target.value)} placeholder="Describe the action..." />
        </div>
      )}
      {nodeType === "Check" && (
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Condition</label>
          <textarea style={styles.textarea} value={config.condition || ""} onChange={(e) => updateConfig("condition", e.target.value)} placeholder="Describe the condition to check..." />
        </div>
      )}
      {nodeType === "Fill" && (
        <>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Form target</label>
            <textarea style={styles.textarea} value={config.target || ""} onChange={(e) => updateConfig("target", e.target.value)} placeholder="Describe which form to fill..." />
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Data (field : value)</label>
            <KeyValueEditor data={config.data || {}} onChange={(d) => updateConfig("data", d)} />
          </div>
        </>
      )}
      {nodeType === "Read" && (
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Task</label>
          <textarea style={styles.textarea} value={config.task || ""} onChange={(e) => updateConfig("task", e.target.value)} placeholder="Describe what to extract..." />
        </div>
      )}
      {nodeType === "Code" && (
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Python code</label>
          <textarea style={styles.codeArea} value={config.code || ""} onChange={(e) => updateConfig("code", e.target.value)} placeholder="await asyncio.sleep(3)" />
        </div>
      )}
      {nodeType === "Agent" && (
        <>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Class name</label>
            <input style={styles.input} value={config.class_name || ""} onChange={(e) => updateConfig("class_name", e.target.value)} placeholder="MyCustomVerb" />
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Task</label>
            <input style={styles.input} value={config.task || ""} onChange={(e) => updateConfig("task", e.target.value)} placeholder="What to do at runtime..." />
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Prompt template</label>
            <textarea style={styles.textarea} value={config.prompt_template || ""} onChange={(e) => updateConfig("prompt_template", e.target.value)} placeholder={"Use {task} to refer to the runtime task.\nExample: Search for {task} and return the first result."} />
          </div>
        </>
      )}

      {nodeType === "ForEach" && (
        <>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Items expression</label>
            <textarea
              style={{ ...styles.textarea, minHeight: 70, fontFamily: 'Consolas, monospace', fontSize: 11 }}
              value={config.items_expr || ''}
              onChange={(e) => updateConfig("items_expr", e.target.value)}
              placeholder={"open('/workspace/uploads/links.txt').read().splitlines()\n# or: ['url1', 'url2']\n# or: read_node_out.urls"}
            />
            <span style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>Any Python expression returning an iterable. Use a Code node above for imports.</span>
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Loop variable name</label>
            <input
              style={styles.input}
              value={config.loop_var || 'item'}
              onChange={(e) => updateConfig("loop_var", e.target.value)}
              placeholder="item"
            />
            <span style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>Reference as {'{{item}}'} in downstream node targets and tasks</span>
          </div>
        </>
      )}

      {(showMaxSteps || showExtraInfo) && (
        <>
          <hr style={divider} />
          <div style={sectionLabel}>ADVANCED</div>
          {showMaxSteps && (
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Max steps</label>
              <input style={styles.numberInput} type="number" min={1} max={100} value={config.max_steps ?? ''} placeholder="unlimited" onChange={(e) => updateConfig("max_steps", e.target.value === '' ? null : parseInt(e.target.value) || null)} />
            </div>
          )}
          {showMaxSteps && (
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Timeout (seconds)</label>
              <input style={styles.numberInput} type="number" min={10} value={config.timeout ?? ''} placeholder="none" onChange={(e) => updateConfig("timeout", e.target.value === '' ? null : parseInt(e.target.value) || null)} />
            </div>
          )}
          {showExtraInfo && (
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Extra info (optional)</label>
              <textarea style={styles.textarea} value={config.extra_info || ""} onChange={(e) => updateConfig("extra_info", e.target.value)} placeholder="Advisory context for the agent..." />
            </div>
          )}

          {nodeType !== "Code" && nodeType !== "ForEach" && (
            <div style={styles.fieldGroup}>
              <label style={styles.label}>LLM override</label>
              <datalist id="node-llm-suggestions">
                {LLM_SUGGESTIONS.map(s => <option key={s} value={s} />)}
              </datalist>
              <input
                list="node-llm-suggestions"
                style={styles.input}
                value={config.llm || ""}
                onChange={(e) => updateConfig("llm", e.target.value || null)}
                placeholder="(use global)"
              />
            </div>
          )}
        </>
      )}

      {/* LLM override when ADVANCED section not shown (Check node) */}
      {!showMaxSteps && !showExtraInfo && nodeType !== "Code" && (
        <>
          <hr style={divider} />
          <div style={sectionLabel}>ADVANCED</div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>LLM override</label>
            <select style={styles.select} value={config.llm || ""} onChange={(e) => updateConfig("llm", e.target.value || null)}>
              {LLM_SUGGESTIONS.map((m) => (<option key={m} value={m}>{m || "(use global)"}</option>))}
            </select>
          </div>
        </>
      )}

      {showSchema && (
        <>
          <hr style={divider} />
          <div style={sectionLabel}>OUTPUT SCHEMA</div>
          <SchemaEditor fields={schemaFields} onChange={updateSchema} />
        </>
      )}

      {/* MCP Servers — available for agent-like nodes */}
      {(nodeType === "Do" || nodeType === "Navigate" || nodeType === "Fill" || nodeType === "Read" || nodeType === "Check" || nodeType === "Agent") && (
        <McpServersEditor
          servers={config.mcp_servers || []}
          onChange={(servers) => updateConfig("mcp_servers", servers.length > 0 ? servers : undefined)}
        />
      )}

      {/* Delete — full-width at bottom */}
      {onDelete && (
        <>
          <hr style={{ ...divider, marginTop: 14 }} />
          <button
            onClick={() => onDelete(node.id)}
            style={{ width: '100%', marginTop: 4, padding: '6px', borderRadius: 5, border: '1px solid #fca5a5', background: 'transparent', color: '#dc2626', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
          >
            Delete node
          </button>
        </>
      )}
    </div>
  );
}

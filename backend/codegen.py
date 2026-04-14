"""Graph JSON -> workflow.py code generator.

Reads /workspace/workflow.json, emits /workspace/workflow.py that uses Orbit
verbs (Do, Navigate, Check, Fill, Read) with the same patterns as hand-written
workflow scripts.
"""

from __future__ import annotations

import json
import re
import textwrap
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


class CodegenError(Exception):
    """Raised when the graph cannot be compiled to valid Python."""


# ── Graph data structures ────────────────────────────────────────────────────

@dataclass
class SchemaField:
    name: str
    type: str  # "str" | "int" | "float" | "bool"

    VALID_TYPES = {"str", "int", "float", "bool"}

    def python_type(self) -> str:
        if self.type not in self.VALID_TYPES:
            raise CodegenError(f"Unknown schema field type: {self.type!r}")
        return self.type


@dataclass
class OutputSchema:
    fields: list[SchemaField]

    def class_name(self, node_id: str) -> str:
        return f"{node_id.replace('-', '_').capitalize()}Output"


@dataclass
class Node:
    id: str
    type: str  # Do | Navigate | Check | Fill | Read | Code
    label: str
    position: dict[str, float]
    config: dict[str, Any]
    output_schema: OutputSchema | None

    VALID_TYPES = {"Do", "Navigate", "Check", "Fill", "Read", "Code", "Agent", "ForEach"}


@dataclass
class Edge:
    id: str
    source: str
    target: str
    type: str  # sequential | conditional_true | conditional_false | loop_back
    max_iterations: int = 3

    VALID_TYPES = {"sequential", "conditional_true", "conditional_false", "loop_back"}


@dataclass
class GlobalConfig:
    llm: str = "gemini-3-flash-preview"
    human_in_the_loop: bool = False
    verbose: bool = True


@dataclass
class LoopGroup:
    """A retry loop detected from a loop_back edge."""
    header: str        # node the back-edge points TO (the Check node)
    body: list[str]    # nodes between header and tail in topo order
    tail: str          # node the back-edge comes FROM
    max_iterations: int


# ── Parsing ──────────────────────────────────────────────────────────────────

def parse_graph(data: dict) -> tuple[GlobalConfig, list[Node], list[Edge]]:
    """Parse the graph JSON into typed objects."""
    global_cfg = GlobalConfig(
        llm=data.get("global", {}).get("llm", "gemini-3-flash-preview"),
        human_in_the_loop=data.get("global", {}).get("human_in_the_loop", False),
        verbose=data.get("global", {}).get("verbose", True),
    )

    nodes = []
    for nd in data.get("nodes", []):
        schema = None
        if nd.get("output_schema") and nd["output_schema"].get("fields"):
            schema = OutputSchema(
                fields=[SchemaField(f["name"], f["type"]) for f in nd["output_schema"]["fields"]]
            )
        node = Node(
            id=nd["id"],
            type=nd["type"],
            label=nd.get("label", nd["id"]),
            position=nd.get("position", {"x": 0, "y": 0}),
            config=nd.get("config", {}),
            output_schema=schema,
        )
        if node.type not in Node.VALID_TYPES:
            raise CodegenError(f"Unknown node type: {node.type!r} on node {node.id!r}")
        nodes.append(node)

    edges = []
    for ed in data.get("edges", []):
        edge = Edge(
            id=ed["id"],
            source=ed["source"],
            target=ed["target"],
            type=ed["type"],
            max_iterations=ed.get("max_iterations", 3),
        )
        if edge.type not in Edge.VALID_TYPES:
            raise CodegenError(f"Unknown edge type: {edge.type!r} on edge {edge.id!r}")
        edges.append(edge)

    return global_cfg, nodes, edges


# ── Graph analysis ───────────────────────────────────────────────────────────

def _build_adjacency(
    nodes: list[Node], edges: list[Edge]
) -> tuple[dict[str, list[Edge]], dict[str, list[Edge]]]:
    out_edges: dict[str, list[Edge]] = defaultdict(list)
    in_edges: dict[str, list[Edge]] = defaultdict(list)
    for e in edges:
        out_edges[e.source].append(e)
        in_edges[e.target].append(e)
    return dict(out_edges), dict(in_edges)


def _detect_loops(edges: list[Edge]) -> list[LoopGroup]:
    """Find loop_back edges and build LoopGroups."""
    loops = []
    for e in edges:
        if e.type == "loop_back":
            loops.append(LoopGroup(
                header=e.target,
                body=[],  # filled during topo sort
                tail=e.source,
                max_iterations=e.max_iterations,
            ))
    # Check for nested loops (not supported in v1)
    if len(loops) > 1:
        headers = {lg.header for lg in loops}
        tails = {lg.tail for lg in loops}
        # Simple heuristic: if any header is also a body member of another loop, it's nested
        # For v1 we just warn; full detection happens below during topo sort
    return loops


def _topo_sort(
    nodes: list[Node], edges: list[Edge], loops: list[LoopGroup]
) -> list[str]:
    """Kahn's algorithm, excluding loop_back edges."""
    node_ids = {n.id for n in nodes}
    non_loop_edges = [e for e in edges if e.type != "loop_back"]

    in_degree: dict[str, int] = {nid: 0 for nid in node_ids}
    adj: dict[str, list[str]] = defaultdict(list)
    for e in non_loop_edges:
        adj[e.source].append(e.target)
        in_degree[e.target] = in_degree.get(e.target, 0) + 1

    queue = [nid for nid in node_ids if in_degree[nid] == 0]
    # Stable sort: prefer nodes in the order they appear in the JSON
    id_order = {n.id: i for i, n in enumerate(nodes)}
    queue.sort(key=lambda x: id_order.get(x, 0))

    order = []
    while queue:
        nid = queue.pop(0)
        order.append(nid)
        for neighbor in adj.get(nid, []):
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)
                queue.sort(key=lambda x: id_order.get(x, 0))

    if len(order) != len(node_ids):
        missing = node_ids - set(order)
        node_labels = {n.id: (n.label or n.type or n.id) for n in nodes}
        # Find the specific edges that form the cycle (edges between stuck nodes)
        cycle_edges = [
            f"{node_labels.get(e.source, e.source)!r} ({e.source}) → {node_labels.get(e.target, e.target)!r} ({e.target})"
            for e in non_loop_edges
            if e.source in missing and e.target in missing
        ]
        detail = (
            f" Cycle edges: {cycle_edges}." if cycle_edges
            else " Check for edges connecting nodes in a circle."
        )
        raise CodegenError(
            f"Graph has a cycle. Delete the edge that loops back, or mark it "
            f"as a loop_back edge by drawing it from a lower node to a higher one.{detail}"
        )

    # Fill loop body lists
    for lg in loops:
        try:
            h_idx = order.index(lg.header)
            t_idx = order.index(lg.tail)
        except ValueError as exc:
            raise CodegenError(f"Loop references unknown node: {exc}") from exc
        if h_idx > t_idx:
            raise CodegenError(
                f"loop_back edge target {lg.header!r} must come before source "
                f"{lg.tail!r} in topological order."
            )
        lg.body = order[h_idx + 1: t_idx]

    return order


# ── Template substitution ────────────────────────────────────────────────────

_SECRETS_RE = re.compile(r"\{\{secrets\.(\w+)\}\}", re.IGNORECASE)


def _resolve_secrets(text: str) -> tuple[str, bool]:
    """Replace {{secrets.KEY}} with {os.environ.get('KEY', '')}.

    Returns (resolved_text, uses_fstring).
    """
    has_secret = bool(_SECRETS_RE.search(text))
    resolved = _SECRETS_RE.sub(
        lambda m: "{os.environ.get('" + m.group(1) + "', '')}", text
    )
    return resolved, has_secret


_TEMPLATE_RE = re.compile(r"\{\{(\w+)\.(\w+)\}\}")
_BARE_VAR_RE = re.compile(r"\{\{(\w+)\}\}")


def _resolve_all(
    text: str, nodes_by_id: dict[str, Node]
) -> tuple[str, bool]:
    """Run both secrets and node-template resolution. Returns (text, uses_fstring)."""
    text, is_secret = _resolve_secrets(text)
    text, is_template = _resolve_templates(text, nodes_by_id)
    # Also resolve bare {{var}} (loop variables like {{item}})
    bare_result, bare_count = _BARE_VAR_RE.subn(r"{\1}", text)
    if bare_count:
        text = bare_result
        is_template = True
    return text, (is_secret or is_template)


def _resolve_templates(
    text: str, nodes_by_id: dict[str, Node]
) -> tuple[str, bool]:
    """Replace {{node_id.field}} with {node_id_out.field}.

    Returns (resolved_text, uses_fstring).
    """
    has_template = False

    def _replace(m: re.Match) -> str:
        nonlocal has_template
        node_id, field_name = m.group(1), m.group(2)
        node = nodes_by_id.get(node_id)
        if not node:
            raise CodegenError(f"Template {{{{{{node_id}}.{field_name}}}}} references unknown node {node_id!r}")
        if not node.output_schema:
            raise CodegenError(
                f"Template {{{{{{node_id}}.{field_name}}}}} references node {node_id!r} "
                f"which has no output_schema"
            )
        field_names = {f.name for f in node.output_schema.fields}
        if field_name not in field_names:
            raise CodegenError(
                f"Template {{{{{{node_id}}.{field_name}}}}} references field {field_name!r} "
                f"not in schema of node {node_id!r} (available: {field_names})"
            )
        has_template = True
        var_name = f"{node_id}_out"
        return "{" + f"{var_name}.{field_name}" + "}"

    resolved = _TEMPLATE_RE.sub(_replace, text)
    return resolved, has_template


# ── Code emission ────────────────────────────────────────────────────────────

def _emit_pydantic_models(nodes: list[Node]) -> list[str]:
    """Generate Pydantic model classes for nodes with output_schema."""
    lines = []
    for node in nodes:
        if not node.output_schema:
            continue
        cls_name = node.output_schema.class_name(node.id)
        lines.append(f"class {cls_name}(BaseModel):")
        for f in node.output_schema.fields:
            lines.append(f"    {f.name}: {f.python_type()}")
        lines.append("")
    return lines


def _esc(s: str) -> str:
    """Escape backslashes and double-quotes so the string is safe inside '\"...\"'."""
    return s.replace("\\", "\\\\").replace('"', '\\"')


def _node_llm_expr(node: Node, global_cfg: GlobalConfig) -> str:
    """Return the Python expression for this node's llm= kwarg."""
    node_llm = node.config.get("llm")
    if node_llm:
        return repr(node_llm)
    return "model"


def _emit_node(
    node: Node,
    global_cfg: GlobalConfig,
    nodes_by_id: dict[str, Node],
    indent: int = 2,
    log_file_path: str | None = None,
) -> list[str]:
    """Emit Python lines for a single node."""
    pad = "    " * indent
    lines = []
    llm = _node_llm_expr(node, global_cfg)
    max_steps = node.config.get("max_steps") or None
    extra_info = node.config.get("extra_info")

    if node.type == "Code":
        lines.append(f'{pad}print("--- {node.id}: {node.label} ---")')
        lines.append(f'{pad}report_node("{node.id}", "running")')
        code = node.config.get("code", "pass")
        dedented = textwrap.dedent(code)
        for line in dedented.splitlines():
            lines.append(f"{pad}{line}")
        lines.append(f'{pad}report_node("{node.id}", "success")')
        return lines

    if node.type != "Check":
        lines.append(f'{pad}report_node("{node.id}", "running")')
        lines.append(f'{pad}print("--- {node.id}: {node.label} ---")')

    # Common kwargs
    steps_arg = f", max_steps={max_steps}" if max_steps is not None else ""
    common = f"session=s, llm={llm}"
    if node.type != "Check":
        common += f"{steps_arg}, verbose=verbose, pause_event=pause_event, planner=False"
        if not global_cfg.human_in_the_loop:
            common += ", human_in_the_loop=False"
        # log_file_path is handled at workflow level via stdout Tee, not per-verb
    else:
        if max_steps is not None:
            common += f", max_steps={max_steps}"

    if extra_info and node.type in ("Do", "Navigate"):
        common += f", extra_info={extra_info!r}"

    if node.type == "Navigate":
        target = node.config.get("target", "").strip()
        target, is_fstr = _resolve_all(target, nodes_by_id)
        target = _esc(target)
        q = "f" if is_fstr else ""
        if node.output_schema:
            lines.append(f"{pad}_{node.id}_result = await Navigate(")
            lines.append(f"{pad}    {q}\"{target}\", {common},")
            lines.append(f"{pad}).run()")
            lines.append(f"{pad}if _{node.id}_result.status == 'error': raise RuntimeError(_{node.id}_result.summary)")
            lines.append(f"{pad}{node.id}_out = _{node.id}_result.output")
        else:
            lines.append(f"{pad}_{node.id}_result = await Navigate(")
            lines.append(f"{pad}    {q}\"{target}\", {common},")
            lines.append(f"{pad}).run()")
            lines.append(f"{pad}if _{node.id}_result.status == 'error': raise RuntimeError(_{node.id}_result.summary)")

    elif node.type == "Do":
        task = node.config.get("task", "").strip()
        task, is_fstr = _resolve_all(task, nodes_by_id)
        task = _esc(task)
        q = "f" if is_fstr else ""
        if node.output_schema:
            cls_name = node.output_schema.class_name(node.id)
            lines.append(f"{pad}_{node.id}_result = await Do(")
            lines.append(f"{pad}    {q}\"{task}\", {common},")
            lines.append(f"{pad}    output_schema={cls_name},")
            lines.append(f"{pad}).run()")
            lines.append(f"{pad}if _{node.id}_result.status == 'error': raise RuntimeError(_{node.id}_result.summary)")
            lines.append(f"{pad}{node.id}_out = _{node.id}_result.output")
        else:
            lines.append(f"{pad}_{node.id}_result = await Do(")
            lines.append(f"{pad}    {q}\"{task}\", {common},")
            lines.append(f"{pad}).run()")
            lines.append(f"{pad}if _{node.id}_result.status == 'error': raise RuntimeError(_{node.id}_result.summary)")

    elif node.type == "Read":
        task = node.config.get("task", "").strip()
        task, is_fstr = _resolve_all(task, nodes_by_id)
        task = _esc(task)
        q = "f" if is_fstr else ""
        if node.output_schema:
            cls_name = node.output_schema.class_name(node.id)
            lines.append(f"{pad}_{node.id}_result = await Read(")
            lines.append(f"{pad}    {q}\"{task}\", schema={cls_name}, {common},")
            lines.append(f"{pad}).run()")
            lines.append(f"{pad}if _{node.id}_result.status == 'error': raise RuntimeError(_{node.id}_result.summary)")
            lines.append(f"{pad}{node.id}_out = _{node.id}_result.output")
        else:
            lines.append(f"{pad}_{node.id}_result = await Read(")
            lines.append(f"{pad}    {q}\"{task}\", {common},")
            lines.append(f"{pad}).run()")
            lines.append(f"{pad}if _{node.id}_result.status == 'error': raise RuntimeError(_{node.id}_result.summary)")

    elif node.type == "Fill":
        target = node.config.get("target", "").strip()
        target, is_fstr_target = _resolve_all(target, nodes_by_id)
        target = _esc(target)
        raw_data = node.config.get("data", {})
        # Resolve secrets in data values
        resolved_data = {}
        is_fstr_data = False
        for k, v in raw_data.items():
            rv, fstr = _resolve_secrets(str(v))
            resolved_data[k] = rv
            if fstr:
                is_fstr_data = True
        is_fstr = is_fstr_target or is_fstr_data
        q = "f" if is_fstr else ""
        # Build data dict literal — use f-string for values that contain {…}
        data_items = ", ".join(f"{k!r}: {q}\"{_esc(v)}\"" for k, v in resolved_data.items())
        lines.append(f"{pad}_{node.id}_result = await Fill(")
        lines.append(f"{pad}    {q}\"{target}\",")
        lines.append(f"{pad}    data={{{data_items}}},")
        lines.append(f"{pad}    {common},")
        lines.append(f"{pad}).run()")
        lines.append(f"{pad}if _{node.id}_result.status == 'error': raise RuntimeError(_{node.id}_result.summary)")

    elif node.type == "Agent":
        class_name = node.config.get("class_name", "CustomVerb").strip()
        task = node.config.get("task", "").strip()
        task, is_fstr = _resolve_all(task, nodes_by_id)
        task = _esc(task)
        q = "f" if is_fstr else ""
        if node.output_schema:
            lines.append(f"{pad}_{node.id}_result = await {class_name}(")
            lines.append(f"{pad}    {q}\"{task}\", {common},")
            lines.append(f"{pad}).run()")
            lines.append(f"{pad}if _{node.id}_result.status == 'error': raise RuntimeError(_{node.id}_result.summary)")
            lines.append(f"{pad}{node.id}_out = _{node.id}_result.output")
        else:
            lines.append(f"{pad}_{node.id}_result = await {class_name}(")
            lines.append(f"{pad}    {q}\"{task}\", {common},")
            lines.append(f"{pad}).run()")
            lines.append(f"{pad}if _{node.id}_result.status == 'error': raise RuntimeError(_{node.id}_result.summary)")

    elif node.type == "Check":
        # Check is handled at the control-flow level, not here
        pass

    if node.type not in ("Check", "Code"):
        lines.append(f'{pad}report_node("{node.id}", "success")')

    return lines


def _emit_check_expr(
    node: Node,
    global_cfg: GlobalConfig,
    nodes_by_id: dict[str, Node],
) -> str:
    """Return the Python expression for a Check node (used in if/for)."""
    llm = _node_llm_expr(node, global_cfg)
    max_steps = node.config.get("max_steps") or None
    condition = node.config.get("condition", "").strip()
    condition, is_fstr = _resolve_all(condition, nodes_by_id)
    condition = _esc(condition)
    q = "f" if is_fstr else ""
    steps_part = f", max_steps={max_steps}" if max_steps is not None else ""
    common = f"session=s, llm={llm}{steps_part}"
    return f'await Check({q}"{condition}", {common}).check()'


# ── Main generation ──────────────────────────────────────────────────────────

def generate(graph_data: dict, log_file_path: str | None = None) -> str:
    """Generate workflow.py source code from graph JSON."""
    global_cfg, nodes, edges = parse_graph(graph_data)
    nodes_by_id = {n.id: n for n in nodes}
    out_edges, in_edges = _build_adjacency(nodes, edges)
    loops = _detect_loops(edges)
    order = _topo_sort(nodes, edges, loops)

    # Build lookup structures
    loop_headers = {lg.header: lg for lg in loops}
    loop_members = set()
    for lg in loops:
        loop_members.add(lg.header)
        loop_members.update(lg.body)
        loop_members.add(lg.tail)

    # Detect conditional branches: Check nodes with true/false edges
    conditionals: dict[str, dict] = {}
    for nid, oe_list in out_edges.items():
        node = nodes_by_id.get(nid)
        if not node or node.type != "Check":
            continue
        true_targets = [e.target for e in oe_list if e.type == "conditional_true"]
        false_targets = [e.target for e in oe_list if e.type == "conditional_false"]
        if true_targets or false_targets:
            conditionals[nid] = {
                "true": true_targets[0] if true_targets else None,
                "false": false_targets[0] if false_targets else None,
            }

    # ── Emit file ─────────────────────────────────────────────────────────
    lines: list[str] = []

    # Header
    lines.append("# AUTO-GENERATED by codegen.py -- do not edit by hand")
    lines.append("# Source: /workspace/workflow.json")
    lines.append("")
    lines.append("from dotenv import load_dotenv")
    lines.append("load_dotenv()")
    lines.append("")
    lines.append("import asyncio")

    # Conditional imports
    # Check if any node config references {{secrets.*}}
    def _has_secrets(cfg: dict) -> bool:
        return any(
            _SECRETS_RE.search(str(v))
            for v in cfg.values()
            if isinstance(v, (str, dict))
            for v in ([v] if isinstance(v, str) else v.values())
        )
    has_secrets = any(_has_secrets(n.config) for n in nodes)
    if has_secrets:
        lines.append("import os")

    has_schema = any(n.output_schema for n in nodes)
    if has_schema:
        lines.append("from pydantic import BaseModel")

    verb_types = {n.type for n in nodes if n.type not in ("Code", "Agent")}
    verb_imports = sorted(verb_types)
    has_agent_nodes = any(n.type == "Agent" for n in nodes)
    if has_agent_nodes:
        # BaseActionAgent must also come from orbit
        orbit_imports = sorted(verb_types | {"BaseActionAgent"})
    else:
        orbit_imports = verb_imports
    if orbit_imports:
        lines.append(f"from orbit import {', '.join(orbit_imports)}, session")
    else:
        lines.append("from orbit import session")
    lines.append("from state import pause_event, report_node")
    lines.append("")
    if log_file_path:
        lines.append(f'_LOG_FILE = {log_file_path!r}')
        lines.append("")

    # Pydantic models (for nodes with output_schema, excluding Agent nodes which handle their own)
    model_lines = _emit_pydantic_models([n for n in nodes if n.type != "Agent"])
    if model_lines:
        lines.append("")
        lines.extend(model_lines)

    # Custom Agent verb classes
    agent_nodes = [n for n in nodes if n.type == "Agent"]
    for node in agent_nodes:
        class_name = node.config.get("class_name", "").strip()
        prompt_template = node.config.get("prompt_template", "").strip()
        if not class_name:
            raise CodegenError(f"Agent node {node.id!r}: class_name is required")
        if not class_name.isidentifier():
            raise CodegenError(f"Agent node {node.id!r}: {class_name!r} is not a valid Python identifier")
        if not prompt_template:
            raise CodegenError(f"Agent node {node.id!r}: prompt_template is required")
        # Pydantic output model
        if node.output_schema:
            out_cls = node.output_schema.class_name(node.id)
            lines.append(f"class {out_cls}(BaseModel):")
            for f in node.output_schema.fields:
                lines.append(f"    {f.name}: {f.python_type()}")
            lines.append("")
        # Verb class
        body = prompt_template.replace("{task}", "{self._task}")
        lines.append(f"class {class_name}(BaseActionAgent):")
        lines.append(f"    def __init__(self, task: str, **kw):")
        lines.append(f"        super().__init__(**kw)")
        lines.append(f"        self._task = task")
        lines.append(f"")
        lines.append(f"    def task_prompt(self) -> str:")
        lines.append(f'        return f"{body}"')
        if node.output_schema:
            out_cls = node.output_schema.class_name(node.id)
            lines.append(f"")
            lines.append(f"    def output_schema(self):")
            lines.append(f"        return {out_cls}")
        lines.append("")

    # Main function
    lines.append("")
    lines.append("async def main(pause_event):")
    lines.append(f'    model = "{global_cfg.llm}"')
    lines.append(f'    verbose = {global_cfg.verbose}')
    lines.append("")
    if log_file_path:
        lines.append('    import sys as _sys')
        lines.append('    _log_fh = open(_LOG_FILE, "w", encoding="utf-8", buffering=1)')
        lines.append('    class _WFTee:')
        lines.append('        def __init__(self, a, b): self._a, self._b = a, b')
        lines.append('        def write(self, d): self._a.write(d); self._b.write(d)')
        lines.append('        def flush(self): self._a.flush(); self._b.flush()')
        lines.append('        def __getattr__(self, n): return getattr(self._a, n)')
        lines.append('    _sys.stdout = _WFTee(_sys.__stdout__, _log_fh)')
        lines.append('    _sys.stderr = _WFTee(_sys.__stderr__, _log_fh)')
        lines.append('')
    lines.append("    async with session() as s:")

    # Walk nodes in topo order, emit code
    emitted: set[str] = set()
    foreach_indent = 2   # bumped to 3 once a ForEach node is emitted
    foreach_node_id: str | None = None
    i = 0
    while i < len(order):
        nid = order[i]
        if nid in emitted:
            i += 1
            continue

        node = nodes_by_id[nid]

        # Case 0: ForEach node — open a for-loop over the items expression
        if node.type == "ForEach":
            loop_var = (node.config.get("loop_var") or "item").strip()
            items_expr = (node.config.get("items_expr") or "[]").strip()
            pad = "    " * foreach_indent
            lines.append(f"{pad}report_node({nid!r}, 'running')")
            lines.append(f"{pad}for {loop_var} in ({items_expr}):")
            foreach_indent = 3
            foreach_node_id = nid
            emitted.add(nid)
            i += 1
            continue

        # Case 1: Loop header
        if nid in loop_headers:
            lg = loop_headers[nid]
            tail_node = nodes_by_id[lg.tail]
            loop_pad = "    " * foreach_indent
            inner_pad_n = foreach_indent + 1
            lines.append(f"{loop_pad}for _attempt_{nid} in range({lg.max_iterations}):")

            if node.type == "Check":
                # Pattern A: Check is the loop header (check-first retry)
                for body_nid in lg.body:
                    body_node = nodes_by_id[body_nid]
                    lines.extend(_emit_node(body_node, global_cfg, nodes_by_id, indent=inner_pad_n, log_file_path=log_file_path))
                    emitted.add(body_nid)

                if tail_node.type != "Check":
                    lines.extend(_emit_node(tail_node, global_cfg, nodes_by_id, indent=inner_pad_n, log_file_path=log_file_path))
                emitted.add(lg.tail)

                check_node, check_nid = node, nid
            else:
                # Pattern B: Non-Check header (e.g. Navigate → Check).
                lines.extend(_emit_node(node, global_cfg, nodes_by_id, indent=inner_pad_n, log_file_path=log_file_path))

                for body_nid in lg.body:
                    body_node = nodes_by_id[body_nid]
                    lines.extend(_emit_node(body_node, global_cfg, nodes_by_id, indent=inner_pad_n, log_file_path=log_file_path))
                    emitted.add(body_nid)

                if tail_node.type != "Check":
                    raise CodegenError(
                        f"Loop from non-Check header {nid!r}: tail node {lg.tail!r} "
                        f"must be a Check node, got {tail_node.type!r}"
                    )
                emitted.add(lg.tail)
                check_node, check_nid = tail_node, lg.tail

            # Emit the Check condition
            check_expr = _emit_check_expr(check_node, global_cfg, nodes_by_id)
            inner_spaces = "    " * inner_pad_n
            lines.append(f'{inner_spaces}report_node("{check_nid}", "running")')
            lines.append(f'{inner_spaces}print("--- {check_nid}: {check_node.label} ---")')
            lines.append(f"{inner_spaces}if {check_expr}:")

            cond = conditionals.get(check_nid, {})
            true_target = cond.get("true")
            break_spaces = "    " * (inner_pad_n + 1)
            if true_target and true_target not in loop_members:
                lines.append(f"{break_spaces}break")
            else:
                lines.append(f"{break_spaces}pass")

            lines.append(f"{inner_spaces}if _attempt_{nid} < {lg.max_iterations - 1}:")
            lines.append(f"{break_spaces}await asyncio.sleep(3)")
            lines.append(f"{loop_pad}else:")
            lines.append(f'{loop_pad}    print("CRITICAL: Failed after {lg.max_iterations} attempts.")')
            lines.append(f"{loop_pad}    return")

            emitted.add(nid)
            i += 1
            continue

        # Case 2: Conditional Check (not in a loop)
        if nid in conditionals and nid not in loop_members:
            cond = conditionals[nid]
            check_expr = _emit_check_expr(node, global_cfg, nodes_by_id)
            pad = "    " * foreach_indent
            inner_pad_n = foreach_indent + 1
            lines.append(f'{pad}report_node("{nid}", "running")')
            lines.append(f'{pad}print("--- {nid}: {node.label} ---")')
            lines.append(f"{pad}if {check_expr}:")

            if cond["true"]:
                true_node = nodes_by_id[cond["true"]]
                true_lines = _emit_node(true_node, global_cfg, nodes_by_id, indent=inner_pad_n, log_file_path=log_file_path)
                lines.extend(true_lines)
                emitted.add(cond["true"])
            else:
                lines.append(f"{'    ' * inner_pad_n}pass")

            if cond["false"]:
                lines.append(f"{pad}else:")
                false_node = nodes_by_id[cond["false"]]
                false_lines = _emit_node(false_node, global_cfg, nodes_by_id, indent=inner_pad_n, log_file_path=log_file_path)
                lines.extend(false_lines)
                emitted.add(cond["false"])

            emitted.add(nid)
            i += 1
            continue

        # Case 3: Regular sequential node (skip standalone Check nodes that were
        # already handled as conditionals or loop headers)
        if nid not in loop_members:
            node_lines = _emit_node(node, global_cfg, nodes_by_id, indent=foreach_indent, log_file_path=log_file_path)
            lines.extend(node_lines)
            emitted.add(nid)

        i += 1

    # Close ForEach loop with success report
    if foreach_node_id:
        lines.append(f"        report_node({foreach_node_id!r}, 'success')")

    # Add blank line and __main__ block
    lines.append("")
    lines.append("")
    lines.append('if __name__ == "__main__":')
    lines.append("    asyncio.run(main(pause_event))")
    lines.append("")

    return "\n".join(lines)


# ── CLI entry point ──────────────────────────────────────────────────────────

def generate_from_file(
    input_path: str = "/workspace/workflow.json",
    output_path: str = "/workspace/workflow.py",
) -> str:
    """Read graph JSON, generate workflow.py, write to disk."""
    data = json.loads(Path(input_path).read_text())
    code = generate(data)
    Path(output_path).write_text(code)
    return code


if __name__ == "__main__":
    code = generate_from_file()
    print(f"Generated {len(code)} bytes -> /workspace/workflow.py")

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow, applyEdgeChanges, applyNodeChanges,
  Background, Controls,
  BaseEdge, EdgeLabelRenderer, getSmoothStepPath,
} from '@xyflow/react';
import OrbitNode from './OrbitNode';

const nodeTypes = { orbitNode: OrbitNode };

// Custom edge with a × delete button at the midpoint
function DeletableEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, label, data, animated }) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  return (
    <>
      <BaseEdge path={edgePath} style={style} />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          {label && (
            <span style={{ fontSize: 10, background: '#fff', padding: '1px 5px', borderRadius: 3, border: '1px solid #e2e2e2', color: '#666' }}>
              {label}
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); data?.onDelete?.(id); }}
            title="Delete edge"
            style={{
              width: 16, height: 16,
              borderRadius: '50%',
              border: '1px solid #ddd',
              background: '#fff',
              color: '#aaa',
              fontSize: 11,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              lineHeight: 1,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#fca5a5'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#aaa'; e.currentTarget.style.borderColor = '#ddd'; }}
          >
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const edgeTypes = { deletable: DeletableEdge };

const EDGE_STROKE = {
  sequential:        '#c0bdb8',
  conditional_true:  '#4ade80',
  conditional_false: '#f87171',
  loop_back:         '#f59e0b',
};

export default function GraphBuilder({ graph, onNodesChange, onEdgesChange, onConnect, onSelectNode, onEdgeDelete, selectedNodeId, nodeStatuses = {} }) {
  // Keep a ref so edge components always call the latest callback, never a stale closure
  const onEdgeDeleteRef = useRef(onEdgeDelete);
  useEffect(() => { onEdgeDeleteRef.current = onEdgeDelete; }, [onEdgeDelete]);
  const stableOnEdgeDelete = useCallback((id) => onEdgeDeleteRef.current?.(id), []);

  const flowNodes = useMemo(
    () =>
      graph.nodes.map((node) => ({
        id: node.id,
        type: 'orbitNode',
        position: node.position,
        width: node.width,
        height: node.height,
        measured: node.measured,
        data: {
          nodeType: node.type,
          label: node.label,
          preview: node.config?.target || node.config?.task || node.config?.condition || node.config?.code || node.config?.class_name || '',
          status: nodeStatuses[node.id] || null,
        },
      })),
    [graph.nodes, nodeStatuses]
  );

  const flowEdges = useMemo(
    () =>
      graph.edges.map((edge) => {
        const label =
          edge.type === 'loop_back' ? `loop ×${edge.max_iterations || 3}`
          : edge.type === 'conditional_true' ? 'true'
          : edge.type === 'conditional_false' ? 'false'
          : '';
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
          type: 'deletable',
          animated: edge.type !== 'sequential',
          label,
          style: {
            stroke: EDGE_STROKE[edge.type] || EDGE_STROKE.sequential,
            strokeWidth: 1.5,
          },
          data: { onDelete: stableOnEdgeDelete },
        };
      }),
    [graph.edges, stableOnEdgeDelete]
  );

  const handleNodesChange = useCallback(
    (changes) => {
      const nextFlowNodes = applyNodeChanges(changes, flowNodes);
      const nextGraphNodes = nextFlowNodes
        .map((fn) => {
          const og = graph.nodes.find((n) => n.id === fn.id);
          if (!og) return undefined;
          return { ...og, position: fn.position, width: fn.width, height: fn.height, measured: fn.measured };
        })
        .filter(Boolean);
      onNodesChange(nextGraphNodes);
    },
    [flowNodes, graph.nodes, onNodesChange]
  );

  const handleEdgesChange = useCallback(
    (changes) => {
      const nextFlowEdges = applyEdgeChanges(changes, flowEdges);
      const nextGraphEdges = nextFlowEdges
        .map((fe) => {
          const og = graph.edges.find((e) => e.id === fe.id);
          return og ? { ...og, source: fe.source, target: fe.target, sourceHandle: fe.sourceHandle, targetHandle: fe.targetHandle } : undefined;
        })
        .filter(Boolean);
      onEdgesChange(nextGraphEdges);
    },
    [flowEdges, graph.edges, onEdgesChange]
  );

  return (
    <div style={{ flex: 1, width: '100%', height: '100%', minHeight: 0, borderRadius: 12, overflow: 'hidden', background: '#f9f9f7', border: '1px solid #e5e4e0', position: 'relative' }}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => onSelectNode(node.id)}
        deleteKeyCode={['Delete', 'Backspace']}
        fitView
        attributionPosition="bottom-left"
      >
        <Background gap={20} color="#d9d9d9" variant="dots" size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>

      {graph.nodes.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', gap: 6 }}>
          <div style={{ fontSize: 28, color: '#d1d0cc' }}>+</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#bbb' }}>Add a node to get started</div>
          <div style={{ fontSize: 11, color: '#ccc' }}>Use the buttons above to add Navigate, Do, Check and more</div>
        </div>
      )}
    </div>
  );
}

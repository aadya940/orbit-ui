import asyncio

pause_event = asyncio.Event()
pause_event.set()  # starts unpaused

_node_statuses: dict[str, str] = {}
_node_outputs: dict[str, object] = {}
_sse_queues: list[asyncio.Queue] = []


def report_node(node_id: str, status: str) -> None:
    _node_statuses[node_id] = status
    for q in _sse_queues:
        q.put_nowait({"node_id": node_id, "status": status})


def report_node_output(node_id: str, output: object) -> None:
    _node_outputs[node_id] = output
    for q in _sse_queues:
        q.put_nowait({"type": "node_output", "node_id": node_id, "output": output})


def reset_execution() -> None:
    _node_statuses.clear()
    _node_outputs.clear()
    for q in _sse_queues:
        q.put_nowait({"type": "reset"})


def get_node_statuses() -> dict:
    return dict(_node_statuses)


def get_node_outputs() -> dict:
    return dict(_node_outputs)

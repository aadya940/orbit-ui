import asyncio

pause_event = asyncio.Event()
pause_event.set()  # starts unpaused

_node_statuses: dict[str, str] = {}
_sse_queues: list[asyncio.Queue] = []


def report_node(node_id: str, status: str) -> None:
    _node_statuses[node_id] = status
    for q in _sse_queues:
        q.put_nowait({"node_id": node_id, "status": status})


def reset_execution() -> None:
    _node_statuses.clear()
    for q in _sse_queues:
        q.put_nowait({"type": "reset"})


def get_node_statuses() -> dict:
    return dict(_node_statuses)

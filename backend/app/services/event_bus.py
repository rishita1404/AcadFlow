"""
In-Memory & Redis-Compatible Asynchronous Event Bus for Server-Sent Events (SSE).
Supports role-scoped real-time event streaming for attendance updates,
risk score recalculations, and notices.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, AsyncIterator, Dict, List, Optional, Set

logger = logging.getLogger("acadflow.events")


class RealtimeEventBus:
    def __init__(self):
        self._subscribers: Set[asyncio.Queue] = set()
        self._subscriber_metadata: Dict[asyncio.Queue, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    async def subscribe(
        self,
        user_id: int,
        role: str,
        department_id: Optional[int] = None,
    ) -> AsyncIterator[Dict[str, Any]]:
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        async with self._lock:
            self._subscribers.add(queue)
            self._subscriber_metadata[queue] = {
                "user_id": user_id,
                "role": role,
                "department_id": department_id,
            }

        # Send initial connected heartbeat
        yield {
            "event": "connected",
            "data": json.dumps({"status": "connected", "user_id": user_id, "role": role}),
        }

        try:
            while True:
                try:
                    # Wait for message with periodic 15s keep-alive ping
                    item = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield item
                except asyncio.TimeoutError:
                    yield {
                        "event": "ping",
                        "data": json.dumps({"ts": int(time.time())}),
                    }
        finally:
            async with self._lock:
                self._subscribers.discard(queue)
                self._subscriber_metadata.pop(queue, None)

    async def broadcast_async(
        self,
        event: str,
        data: Dict[str, Any],
        department_id: Optional[int] = None,
        target_student_id: Optional[int] = None,
    ) -> int:
        payload = {
            "event": event,
            "data": json.dumps(data, default=str),
        }
        delivered = 0
        async with self._lock:
            for queue, meta in list(self._subscriber_metadata.items()):
                # Role-scoped filtering:
                # 1. Admin receives all events
                if meta["role"] == "admin":
                    try:
                        queue.put_nowait(payload)
                        delivered += 1
                    except asyncio.QueueFull:
                        pass
                    continue

                # 2. Coordinator & Faculty receive department-scoped events
                if meta["role"] in ("coordinator", "faculty", "trainer"):
                    if (
                        department_id is None
                        or meta["department_id"] is None
                        or meta["department_id"] == department_id
                    ):
                        try:
                            queue.put_nowait(payload)
                            delivered += 1
                        except asyncio.QueueFull:
                            pass
                    continue

                # 3. Student only receives events targeting them
                if meta["role"] == "student":
                    if target_student_id and meta["user_id"] == target_student_id:
                        try:
                            queue.put_nowait(payload)
                            delivered += 1
                        except asyncio.QueueFull:
                            pass

        return delivered

    def broadcast(
        self,
        event: str,
        data: Dict[str, Any],
        department_id: Optional[int] = None,
        target_student_id: Optional[int] = None,
    ) -> None:
        """Synchronous wrapper to fire-and-forget an event onto active loop."""
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(
                self.broadcast_async(event, data, department_id, target_student_id)
            )
        except RuntimeError:
            # No running event loop (e.g. running in synchronous worker or test runner)
            pass


event_bus = RealtimeEventBus()

from __future__ import annotations

import asyncio
import json
import queue

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse

from backend.services.eeg_processor import EEGProcessor

router = APIRouter()


@router.get("/api/eeg/status")
async def eeg_status():
    processor = EEGProcessor.get_instance()
    return JSONResponse(
        {
            "connected": processor.connected,
            "latest_metrics": processor.latest_metrics,
        }
    )


@router.websocket("/ws/eeg")
async def eeg_websocket(ws: WebSocket):
    await ws.accept()
    processor = EEGProcessor.get_instance()
    processor.start()

    metrics_queue: queue.Queue = queue.Queue(maxsize=100)
    processor.subscribe(metrics_queue)

    try:
        while True:
            try:
                metrics = await asyncio.get_event_loop().run_in_executor(
                    None, lambda: metrics_queue.get(timeout=1.0)
                )
                await ws.send_text(json.dumps(metrics))
            except queue.Empty:
                # Send a keepalive ping check
                try:
                    await asyncio.wait_for(ws.receive_text(), timeout=0.01)
                except (asyncio.TimeoutError, WebSocketDisconnect):
                    pass
    except WebSocketDisconnect:
        pass
    finally:
        processor.unsubscribe(metrics_queue)

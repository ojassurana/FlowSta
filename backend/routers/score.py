import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from backend.models import ScoreRequest, ScoreResponse, ScoreResult
from backend.services.scorer import score_blocks, score_blocks_streaming

router = APIRouter()


@router.post("/score", response_model=ScoreResponse)
async def score_endpoint(req: ScoreRequest):
    if not req.blocks:
        return ScoreResponse(scores=[])

    if len(req.blocks) < 5:
        return ScoreResponse(
            scores=[ScoreResult(id=b.id, score=1.0, reasoning="Page too small to filter") for b in req.blocks]
        )

    try:
        scores = await score_blocks(req.intent, req.blocks)
        return ScoreResponse(scores=scores)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Scoring failed: {e}")


@router.post("/score-stream")
async def score_stream_endpoint(req: ScoreRequest):
    """Stream scoring results as NDJSON, yielding each batch as it completes."""
    if not req.blocks:
        return ScoreResponse(scores=[])

    if len(req.blocks) < 5:
        return ScoreResponse(
            scores=[ScoreResult(id=b.id, score=1.0, reasoning="Page too small to filter") for b in req.blocks]
        )

    async def generate():
        async for batch_scores in score_blocks_streaming(req.intent, req.blocks):
            line = json.dumps({"scores": [s.model_dump() for s in batch_scores]})
            yield line + "\n"

    return StreamingResponse(generate(), media_type="application/x-ndjson")

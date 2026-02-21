from fastapi import APIRouter, HTTPException

from backend.models import InterpretRequest, InterpretResponse
from backend.services.interpreter import interpret

router = APIRouter()


@router.post("/interpret", response_model=InterpretResponse)
async def interpret_endpoint(req: InterpretRequest):
    try:
        intent = await interpret(req.transcript, req.prior_intent)
        return InterpretResponse(intent=intent)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Interpretation failed: {e}")

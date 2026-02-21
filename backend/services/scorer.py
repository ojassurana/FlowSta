import asyncio
import json

from backend.models import FocusIntent, ContentBlock, ScoreResult
from backend.services.claude_client import call_llm

SYSTEM_PROMPT = """You are the content-relevance scorer for FlowState, an accessibility app. Given a user's focus intent and a list of content blocks extracted from a webpage, score each block for relevance to the user's focus.

SCORING GUIDELINES:

Score 0.9-1.0 (DIRECTLY RELEVANT):
  The block's text explicitly discusses one of the focus topics.
  It contains keywords or directly answers the user's information need.

Score 0.7-0.89 (CONTEXTUALLY RELEVANT):
  The block provides important supporting context for a focus topic.
  It may be a heading above relevant content, or metadata associated with relevant content.

Score 0.4-0.69 (TANGENTIALLY RELATED):
  The block shares some thematic overlap but is not what the user specifically asked for.
  It might mention a focus keyword in passing.

Score 0.15-0.39 (STRUCTURAL / NOT RELEVANT):
  The block is structural (navigation, site header, footer) or discusses a completely different topic.

Score 0.0-0.14 (IRRELEVANT / DISTRACTING):
  The block is an advertisement, cookie banner, unrelated promotional content, or completely off-topic.

SPECIAL RULES:
- Navigation elements: default 0.3 unless the user's focus explicitly involves navigation.
- Page title / site header: always at least 0.5 (provides orientation).
- If the focus mode is "EXCLUDE", invert the logic: blocks matching the topics should score LOW, everything else scores HIGH.

You MUST respond with ONLY valid JSON. No explanation, no markdown fences, no extra text.

OUTPUT FORMAT:
{
  "scores": [
    { "id": "block_id", "score": 0.0-1.0, "reasoning": "one short sentence" }
  ]
}"""

BATCH_SIZE = 50


async def _score_batch(intent: FocusIntent, batch: list[ContentBlock]) -> list[ScoreResult]:
    """Score a single batch of content blocks."""
    user_msg = json.dumps({
        "intent": intent.model_dump(),
        "blocks": [b.model_dump() for b in batch],
    })

    response_text = await call_llm(SYSTEM_PROMPT, user_msg, max_tokens=8192)

    # Strip markdown fences if present
    text = response_text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines)

    parsed = json.loads(text)
    results = []
    for s in parsed.get("scores", []):
        score_val = max(0.0, min(1.0, float(s.get("score", 0.5))))
        results.append(ScoreResult(
            id=s["id"],
            score=score_val,
            reasoning=s.get("reasoning", ""),
        ))
    return results


async def score_blocks(intent: FocusIntent, blocks: list[ContentBlock]) -> list[ScoreResult]:
    """Score content blocks against a FocusIntent using OpenAI."""
    batches = [blocks[i:i + BATCH_SIZE] for i in range(0, len(blocks), BATCH_SIZE)]

    if len(batches) == 1:
        return await _score_batch(intent, batches[0])

    tasks = [_score_batch(intent, batch) for batch in batches]
    batch_results = await asyncio.gather(*tasks)

    all_results = []
    for batch_result in batch_results:
        all_results.extend(batch_result)

    # Fill in defaults for any blocks not scored
    scored_ids = {r.id for r in all_results}
    for block in blocks:
        if block.id not in scored_ids:
            all_results.append(ScoreResult(
                id=block.id,
                score=block.default_score,
                reasoning="Default score (not returned by scorer)",
            ))

    return all_results


async def score_blocks_streaming(intent: FocusIntent, blocks: list[ContentBlock]):
    """Yield scored results progressively as each batch completes."""
    batches = [blocks[i:i + BATCH_SIZE] for i in range(0, len(blocks), BATCH_SIZE)]

    if not batches:
        return

    async def safe_score(batch):
        try:
            return await _score_batch(intent, batch)
        except Exception:
            return [ScoreResult(id=b.id, score=b.default_score, reasoning="Default (scoring error)") for b in batch]

    if len(batches) == 1:
        yield await safe_score(batches[0])
        return

    scored_ids = set()
    pending = {asyncio.ensure_future(safe_score(batch)) for batch in batches}

    while pending:
        done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
        for task in done:
            results = task.result()
            for r in results:
                scored_ids.add(r.id)
            yield results

    # Fill defaults for any unscored blocks
    defaults = [
        ScoreResult(id=b.id, score=b.default_score, reasoning="Default score (not returned by scorer)")
        for b in blocks if b.id not in scored_ids
    ]
    if defaults:
        yield defaults

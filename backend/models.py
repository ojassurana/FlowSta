from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


# --- Page Fetch ---

class FetchPageRequest(BaseModel):
    url: str


class FetchPageResponse(BaseModel):
    html: str
    base_url: str
    title: str | None = None


# --- Transcribe ---

class TranscribeResponse(BaseModel):
    transcript: str


# --- Focus Intent ---

class Topic(BaseModel):
    label: str
    keywords: list[str]
    semantic_description: str


class FocusIntent(BaseModel):
    mode: Literal["FOCUS", "EXCLUDE"]
    topics: list[Topic]
    merge_strategy: Literal["REPLACE", "ADD", "SUBTRACT"]
    confidence: float = Field(ge=0.0, le=1.0)
    ambiguity_note: str | None = None


class InterpretRequest(BaseModel):
    transcript: str
    prior_intent: FocusIntent | None = None


class InterpretResponse(BaseModel):
    intent: FocusIntent


# --- Content Scoring ---

class ContentBlockContext(BaseModel):
    parent_heading: str = ""
    section_path: list[str] = []
    surrounding_text: str = ""


class ContentBlock(BaseModel):
    id: str
    element_type: str
    text_content: str
    context: ContentBlockContext = ContentBlockContext()
    structural_role: str = "content"
    default_score: float = 0.5


class ScoreResult(BaseModel):
    id: str
    score: float = Field(ge=0.0, le=1.0)
    reasoning: str = ""


class ScoreRequest(BaseModel):
    intent: FocusIntent
    blocks: list[ContentBlock]


class ScoreResponse(BaseModel):
    scores: list[ScoreResult]


# --- Error ---

class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None

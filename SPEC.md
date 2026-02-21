# FlowState — Behavioral Specification

> An accessibility-focused intelligent webpage viewer for users with ADHD.
> FlowState lets users load any webpage, speak a focus instruction, and instantly dims everything irrelevant — keeping layout intact while surfacing only what matters.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Component Architecture](#2-component-architecture)
3. [Pipeline: Speech Capture → DOM Transformation](#3-pipeline-speech-capture--dom-transformation)
4. [Stage 1 — Speech Capture & Transcription](#4-stage-1--speech-capture--transcription)
5. [Stage 2 — Semantic Interpretation of Focus Intent](#5-stage-2--semantic-interpretation-of-focus-intent)
6. [Stage 3 — Content Extraction & Relevance Scoring](#6-stage-3--content-extraction--relevance-scoring)
7. [Stage 4 — Dynamic DOM Transformation](#7-stage-4--dynamic-dom-transformation)
8. [Follow-Up Refinement Logic](#8-follow-up-refinement-logic)
9. [AI Prompt Logic & Routines](#9-ai-prompt-logic--routines)
10. [Example Scenarios](#10-example-scenarios)
11. [Edge Cases & Error Handling](#11-edge-cases--error-handling)
12. [Accessibility Considerations](#12-accessibility-considerations)

---

## 1. System Overview

### Purpose

Users with ADHD are frequently overwhelmed by information-dense webpages. FlowState acts as a "focus lens" — the user tells it what matters (via voice), and the app intelligently dims everything else on the page. The page layout never shifts; only visual salience changes.

### Core Interaction Loop

```
┌──────────────────────────────────────────────────────────┐
│  User enters URL  →  Page loads in viewer                │
│                                                          │
│  User taps mic  →  Speaks focus instruction               │
│       "Only show me the event dates and venue"           │
│                                                          │
│  System:                                                 │
│    1. Transcribes speech to text                         │
│    2. Interprets semantic focus intent                   │
│    3. Extracts & scores every content block on the page  │
│    4. Dims irrelevant blocks, highlights relevant ones   │
│                                                          │
│  User speaks again  →  Refines or changes focus          │
│       "Also show the ticket prices"                      │
│                                                          │
│  System updates dim/highlight state incrementally        │
└──────────────────────────────────────────────────────────┘
```

### Design Principles

- **Zero layout shift.** Dimming changes opacity and visual emphasis only. No elements are removed, reordered, or repositioned.
- **Graceful ambiguity handling.** Loosely phrased instructions are interpreted generously rather than failing.
- **Incremental refinement.** Each follow-up command builds on (or replaces) the current focus state.
- **Reversible.** A "reset" action restores the page to its original visual state instantly.

---

## 2. Component Architecture

### 2.1 URL Input Bar

| Property | Detail |
|---|---|
| **Position** | Fixed at the top of the viewport |
| **Input** | A single text field accepting any HTTP/HTTPS URL |
| **Output** | Triggers the Page Viewer to load the target URL |
| **Validation** | Checks for well-formed URLs; shows inline error for malformed input |
| **Behavior** | On submit (Enter key or button), the viewer loads the page. A loading indicator is shown during fetch. Previous focus state is cleared when a new URL is loaded. |

### 2.2 Page Viewer

| Property | Detail |
|---|---|
| **Role** | Renders the loaded webpage content in a sandboxed container |
| **Input** | The fetched HTML content from the URL Input Bar |
| **Output** | A fully rendered DOM tree that the Transformation Engine can manipulate |
| **Behavior** | Displays the page as close to its original rendering as possible. All content blocks are tagged with unique identifiers for later scoring and transformation. Preserves images, tables, lists, headings, forms, and navigation elements. |

### 2.3 Floating Mic Button

| Property | Detail |
|---|---|
| **Position** | Fixed on the right edge of the viewport, vertically centered |
| **Visual States** | **Idle** (microphone icon, muted color), **Listening** (pulsing animation, accent color), **Processing** (spinner animation) |
| **Input** | User tap/click |
| **Output** | Activates the Speech Capture module; passes captured audio to the transcription pipeline |
| **Behavior** | Single press to start listening. Listening ends automatically after a configurable silence threshold (default: 2 seconds of silence) or on a second press. Visual feedback clearly indicates the current state. |

### 2.4 Speech Capture Module

| Property | Detail |
|---|---|
| **Role** | Captures microphone audio and produces a text transcript |
| **Input** | Raw audio stream from the user's microphone |
| **Output** | A plain-text transcript string of the user's spoken instruction |
| **Behavior** | See [Stage 1](#4-stage-1--speech-capture--transcription) for full detail |

### 2.5 Semantic Interpreter (AI Core)

| Property | Detail |
|---|---|
| **Role** | Converts the raw transcript into a structured focus intent object |
| **Input** | The transcript string + current focus state (if any) |
| **Output** | A `FocusIntent` object (see Stage 2) |
| **Behavior** | See [Stage 2](#5-stage-2--semantic-interpretation-of-focus-intent) for full detail |

### 2.6 Content Scorer (AI Core)

| Property | Detail |
|---|---|
| **Role** | Scores every content block on the page against the focus intent |
| **Input** | The `FocusIntent` object + the page's extracted content blocks |
| **Output** | A `ScoredContentMap` — each block ID mapped to a relevance score 0.0–1.0 |
| **Behavior** | See [Stage 3](#6-stage-3--content-extraction--relevance-scoring) for full detail |

### 2.7 Transformation Engine

| Property | Detail |
|---|---|
| **Role** | Applies visual transformations to the rendered DOM based on relevance scores |
| **Input** | The `ScoredContentMap` |
| **Output** | Modified inline styles on DOM elements (opacity, filter, pointer-events) |
| **Behavior** | See [Stage 4](#7-stage-4--dynamic-dom-transformation) for full detail |

---

## 3. Pipeline: Speech Capture → DOM Transformation

```
 ┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
 │   STAGE 1   │     │     STAGE 2      │     │     STAGE 3      │     │     STAGE 4      │
 │   Speech    │────▶│    Semantic       │────▶│    Content        │────▶│  DOM             │
 │   Capture   │     │    Interpretation │     │    Scoring        │     │  Transformation  │
 └─────────────┘     └──────────────────┘     └──────────────────┘     └─────────────────┘
       │                      │                        │                        │
   Raw audio           Transcript text          FocusIntent obj         ScoredContentMap
       ↓                      ↓                        ↓                        ↓
   Transcript         FocusIntent obj          ScoredContentMap        Visual DOM changes
```

Each stage is detailed below.

---

## 4. Stage 1 — Speech Capture & Transcription

### Trigger
User presses the floating mic button.

### Process

1. **Microphone activation.** Request microphone permission (if not already granted). On denial, show an accessible error message and suggest typing the instruction instead.
2. **Audio streaming.** Capture audio in real time from the device microphone.
3. **Silence detection.** Monitor audio levels continuously. When the signal drops below a silence threshold for a configurable duration (default: 2 seconds), automatically stop recording.
4. **Manual stop.** User can also press the mic button again to stop recording early.
5. **Transcription via OpenAI Whisper.** Send the captured audio to the OpenAI Whisper API for speech-to-text transcription. Whisper handles multilingual input, accented speech, and background noise robustly. The API returns a plain-text transcript.
   - Audio is sent as a single request after recording ends (not streamed).
   - Format: WebM/Opus or WAV, whichever the browser natively produces.
   - Language detection is automatic (Whisper's default), but can be overridden in settings.
6. **Transcript display.** Briefly show the transcribed text to the user in a toast or overlay so they can confirm the system heard them correctly.
7. **Error recovery.** If Whisper returns an error or empty transcript, show "I didn't catch that — try again?" and return to idle state.

### Input / Output

| | Type | Description |
|---|---|---|
| **Input** | Audio stream | Raw microphone audio |
| **Output** | `string` | Plain-text transcript of the spoken instruction |

### Example Transcripts

| Spoken | Transcript |
|---|---|
| "Only show me the event location and timings" | `"Only show me the event location and timings"` |
| "I just want the prices" | `"I just want the prices"` |
| "Hide everything except the author bio" | `"Hide everything except the author bio"` |

---

## 5. Stage 2 — Semantic Interpretation of Focus Intent

### Purpose
Convert the raw transcript into a structured representation of what the user wants to focus on. This stage must handle ambiguity, colloquial language, negations, and follow-up refinements.

### Process

1. **Receive transcript** and any existing `FocusIntent` from a prior command in this session.
2. **Send to the Claude API** (Anthropic) with a carefully designed system prompt (see [Section 9](#9-ai-prompt-logic--routines) for the full prompt). Claude is used for all semantic reasoning in FlowState — both intent interpretation and content scoring.
3. **Claude returns a `FocusIntent` object** with the following structure:

```
FocusIntent {
  mode: "FOCUS" | "EXCLUDE"          // Does the user want to SHOW these topics, or HIDE them?
  topics: [                           // One or more semantic topics the user cares about
    {
      label: string                   // Human-readable topic label (e.g., "event dates")
      keywords: string[]              // Specific words/phrases to match in content
      semantic_description: string    // Natural-language description of what qualifies
    }
  ]
  merge_strategy: "REPLACE" | "ADD" | "SUBTRACT"
                                      // How this intent relates to the prior focus state:
                                      //   REPLACE = discard previous, use this
                                      //   ADD     = keep previous focus, also focus on these
                                      //   SUBTRACT = keep previous focus, remove these topics
  confidence: float                   // 0.0–1.0, model's confidence in interpretation
  ambiguity_note: string | null       // If confidence < 0.7, a human-readable note
                                      //   explaining what was ambiguous
}
```

4. **Ambiguity handling.** If the model's confidence is below 0.7, the system shows the `ambiguity_note` to the user and asks for clarification before proceeding. Example: "Did you mean event dates, or the dates in the article's publication info?"
5. **Negation detection.** Phrases like "hide the sidebar" or "remove the ads" are interpreted as `mode: "EXCLUDE"` with the relevant topics. Phrases like "only show X" or "focus on X" are interpreted as `mode: "FOCUS"`.

### Input / Output

| | Type | Description |
|---|---|---|
| **Input** | `{ transcript: string, prior_intent: FocusIntent | null }` | The spoken text and any existing focus state |
| **Output** | `FocusIntent` | Structured focus intent object |

### Interpretation Rules

| Spoken Instruction | Interpreted Mode | Topics | Merge Strategy |
|---|---|---|---|
| "Only show me the event location and timings" | FOCUS | `[{label: "event location"}, {label: "event timings"}]` | REPLACE |
| "Also show the ticket prices" | FOCUS | `[{label: "ticket prices"}]` | ADD |
| "Actually, remove the timings" | FOCUS | `[{label: "event timings"}]` | SUBTRACT |
| "Hide the sidebar and ads" | EXCLUDE | `[{label: "sidebar"}, {label: "advertisements"}]` | REPLACE |
| "Just the recipe, nothing else" | FOCUS | `[{label: "recipe instructions"}, {label: "recipe ingredients"}]` | REPLACE |
| "Never mind, show everything" | — | `[]` | REPLACE (triggers full reset) |

---

## 6. Stage 3 — Content Extraction & Relevance Scoring

### Purpose
Analyse every content block on the loaded webpage and assign each a relevance score (0.0 to 1.0) based on the `FocusIntent`.

### 6.1 Content Extraction

Before scoring, the system must decompose the page into scorable units called **content blocks**.

#### Block Identification Rules

| Element Type | Blocking Strategy |
|---|---|
| **Headings** (`h1`–`h6`) | Each heading is its own block. It also acts as a "section header" — its score influences the children beneath it. |
| **Paragraphs** (`p`) | Each paragraph is its own block. |
| **List items** (`li`) | Each list item is its own block. The parent `ul`/`ol` inherits the maximum score of its children. |
| **Table rows** (`tr`) | Each row is its own block. Table headers (`th`) are always kept visible (score 1.0) if any row in the table scores above the relevance threshold. |
| **Images** (`img`) | Each image is its own block. Scored by `alt` text, surrounding context (caption, nearest heading), and `title` attribute. |
| **Navigation** (`nav`, menus) | Treated as structural blocks. By default scored at 0.3 (lightly dimmed) unless the user's focus explicitly includes navigation. |
| **Sidebar/aside** (`aside`) | Treated as structural blocks. Default score 0.2 unless relevant. |
| **Forms** (`form`) | Each form is a single block. Scored by its labels, placeholder text, and surrounding headings. |
| **Embedded media** (`video`, `audio`, `iframe`) | Each is a single block. Scored by surrounding context and any available metadata. |
| **Footer** (`footer`) | Default score 0.15 unless relevant. |
| **Advertisements / cookie banners** | Identified heuristically (common class names, ARIA roles, known patterns). Default score 0.05. |

#### Content Block Schema

```
ContentBlock {
  id: string                  // Unique identifier for this block in the DOM
  element_type: string        // e.g., "p", "h2", "li", "img"
  text_content: string        // The visible text of the element (or alt text for images)
  context: {
    parent_heading: string    // Text of the nearest ancestor heading
    section_path: string[]    // Breadcrumb of headings above this block
    surrounding_text: string  // ~50 characters before and after for context
  }
  structural_role: string     // "content" | "navigation" | "sidebar" | "footer" | "ad" | "header"
  default_score: float        // Structural role's baseline score (see table above)
}
```

### 6.2 Relevance Scoring

The extracted content blocks and the `FocusIntent` are sent together to the Claude API for scoring.

#### Scoring Process

1. **Batch the content blocks.** Group blocks into batches of ~50 to stay within Claude's context window. Include the full `FocusIntent` with each batch. Claude's large context window (200k tokens) means most pages can be scored in a single call.
2. **For each block, Claude evaluates:**
   - **Keyword match:** Does the block's text contain any of the `FocusIntent.topics[].keywords`? (High signal)
   - **Semantic match:** Does the block's meaning relate to any `FocusIntent.topics[].semantic_description`? (Medium-high signal)
   - **Contextual match:** Is the block inside a section (by heading hierarchy) that is relevant? (Medium signal)
   - **Structural role:** What is the block's default score based on its structural role? (Baseline)
3. **Claude returns a score 0.0–1.0 for each block:**

| Score Range | Meaning | Visual Treatment |
|---|---|---|
| **0.9–1.0** | Directly relevant — matches the user's focus intent | Full opacity, optional subtle highlight |
| **0.7–0.89** | Contextually relevant — provides supporting information for the focused topic | Full opacity, no highlight |
| **0.4–0.69** | Tangentially related — shares some topical overlap | Moderately dimmed (opacity ~0.35) |
| **0.15–0.39** | Not relevant, but structural (nav, headers) | Heavily dimmed (opacity ~0.15) |
| **0.0–0.14** | Irrelevant content or distracting elements (ads, unrelated sections) | Near-invisible (opacity ~0.08) |

4. **Score propagation rules:**
   - If a heading scores ≥ 0.7, all direct child blocks get a minimum score of 0.5 (they are contextually relevant).
   - If all children of a container score below 0.3, the container itself gets the average of its children's scores.
   - If any child of a container scores ≥ 0.9, the container gets at least 0.7.
   - Parent `<ul>`/`<ol>` elements inherit the max score of their `<li>` children.

### Input / Output

| | Type | Description |
|---|---|---|
| **Input** | `{ intent: FocusIntent, blocks: ContentBlock[] }` | The structured focus intent and all extracted content blocks |
| **Output** | `ScoredContentMap: Map<block_id, { score: float, reasoning: string }>` | Each block's relevance score and a short explanation |

---

## 7. Stage 4 — Dynamic DOM Transformation

### Purpose
Apply visual changes to the rendered page based on the `ScoredContentMap`. The user should immediately perceive a "focused" version of the page where relevant content stands out and irrelevant content fades away.

### Transformation Rules

#### 7.1 Opacity Mapping

The score-to-opacity mapping follows a curve that creates clear visual separation:

```
opacity(score) =
  if score >= 0.7:  1.0                        // Fully visible
  if score >= 0.4:  0.25 + (score - 0.4) * 2.5 // Gradual fade: 0.25 → 1.0
  if score >= 0.15: 0.10 + (score - 0.15) * 0.6 // Heavy fade: 0.10 → 0.25
  if score <  0.15: 0.06                        // Near-invisible
```

#### 7.2 Additional Visual Treatments

| Score Range | Treatment |
|---|---|
| **≥ 0.9** | Full opacity. A subtle left-border accent line (3px, theme color) is applied to draw the eye. |
| **0.7–0.89** | Full opacity. No additional treatment. |
| **0.4–0.69** | Reduced opacity per curve. `filter: grayscale(50%)` applied to further de-emphasize. |
| **< 0.4** | Reduced opacity per curve. `filter: grayscale(80%) blur(0.5px)` to make content unreadable without removing it from layout. `pointer-events: none` to prevent accidental interaction. |

#### 7.3 Layout Preservation Rules

- **No `display: none`.** Elements are never hidden. They remain in the document flow.
- **No `visibility: hidden`.** This would cause empty gaps. Opacity is used instead.
- **No `position` changes.** Elements stay exactly where they are.
- **No `height`/`width` changes.** The physical space each element occupies is unchanged.
- **No reordering.** DOM order is never modified.

#### 7.4 Transition & Animation

- All opacity and filter changes are applied with a CSS transition (duration: 400ms, easing: ease-in-out) for a smooth, non-jarring visual shift.
- When switching between focus states (follow-up commands), elements smoothly transition from their old opacity to their new opacity.

#### 7.5 Highlight Scroll

After transformation is applied, the viewport automatically scrolls to the first content block with a score ≥ 0.9, placing it roughly one-third from the top of the viewport. This gives the user an immediate anchor point.

### Input / Output

| | Type | Description |
|---|---|---|
| **Input** | `ScoredContentMap` | Block IDs mapped to relevance scores |
| **Output** | Modified DOM styles (opacity, filter, border, pointer-events, transitions) | Visual changes applied directly to the rendered page |

---

## 8. Follow-Up Refinement Logic

FlowState supports an ongoing conversation-like interaction where users refine their focus incrementally.

### State Management

The system maintains a **FocusSession** object that persists for the duration of viewing a single URL:

```
FocusSession {
  url: string                          // The currently loaded URL
  history: FocusIntent[]               // Ordered list of all intents in this session
  active_intent: FocusIntent           // The currently effective merged intent
  scored_map: ScoredContentMap         // The current relevance scores
  is_active: boolean                   // Whether a focus filter is currently applied
}
```

### Merge Behavior

When a new `FocusIntent` arrives with a `merge_strategy`:

| Strategy | Behavior |
|---|---|
| **REPLACE** | Discard the previous `active_intent`. The new intent becomes the sole focus. Re-score all blocks against the new intent only. |
| **ADD** | Append the new intent's topics to the existing `active_intent.topics`. Re-score all blocks. Blocks that match *either* the old or new topics will score high. |
| **SUBTRACT** | Remove any topics from `active_intent.topics` that semantically overlap with the new intent's topics. Re-score all blocks. |

### Reset

If the user says "show everything", "reset", "clear focus", or "never mind":
- `FocusSession.is_active` is set to `false`.
- All DOM elements are transitioned back to `opacity: 1.0`, `filter: none`, `pointer-events: auto`.
- The `FocusSession.history` is preserved so the user can say "go back to my last focus" to restore the previous state.

### Undo

If the user says "undo", "go back", or "revert":
- Pop the most recent entry from `FocusSession.history`.
- Set `active_intent` to the previous entry.
- Re-score and re-transform.

---

## 9. AI Prompt Logic & Routines

### 9.0 Technology Choices

| Capability | Technology | Rationale |
|---|---|---|
| **Speech-to-Text** | **OpenAI Whisper API** | Industry-leading accuracy for natural speech, handles accents, background noise, and multilingual input. Audio is sent as a single POST request after recording ends. |
| **Semantic Interpretation** | **Claude API (Anthropic)** | Strong natural-language understanding for parsing ambiguous user instructions into structured intent. Used with structured JSON output mode. |
| **Content Relevance Scoring** | **Claude API (Anthropic)** | Claude's large context window (200k tokens) allows scoring entire pages in a single call. Its reasoning ability accurately maps content blocks to semantic topics. |

Both AI calls (interpretation and scoring) can use Claude Sonnet for speed, or Claude Opus for higher accuracy on complex pages. The system defaults to Sonnet and falls back to Opus when the page has more than 200 content blocks or the user's instruction has confidence < 0.7 on first pass.

### 9.1 System Prompt — Semantic Interpreter

This prompt is sent to the Claude API whenever a user's transcript needs to be converted into a `FocusIntent`.

```
SYSTEM PROMPT — SEMANTIC INTERPRETER

You are the focus-intent interpreter for FlowState, an accessibility app
for users with ADHD. Your job is to convert a user's spoken instruction
into a structured FocusIntent object.

CONTEXT:
- The user is viewing a webpage and wants to reduce visual clutter.
- They speak a natural-language instruction describing what they want to
  focus on (or what they want to hide).
- You must interpret their intent even if the language is vague, informal,
  or ambiguous.

RULES:
1. Default to mode "FOCUS" (user wants to SEE these topics).
   Only use mode "EXCLUDE" if the user explicitly says "hide", "remove",
   "get rid of", or similar exclusionary language.

2. Break the instruction into one or more distinct topics. Each topic
   should have:
   - label: a short human-readable name (2-5 words)
   - keywords: specific words or phrases that would appear in relevant
     content (include synonyms and related terms)
   - semantic_description: a one-sentence description of what content
     qualifies as matching this topic

3. For merge_strategy:
   - Use "REPLACE" if the user says "only", "just", "nothing but", or
     if there is no prior focus state.
   - Use "ADD" if the user says "also", "and", "additionally", "as well",
     "too", or references adding to what they already see.
   - Use "SUBTRACT" if the user says "remove", "except", "not", "without",
     "take away", or references removing a specific topic from the
     current view.

4. Set confidence to a value between 0.0 and 1.0 reflecting how certain
   you are about the interpretation. If below 0.7, provide an
   ambiguity_note explaining what is unclear.

5. Be generous with keyword generation. Include:
   - Direct terms from the user's speech
   - Synonyms (e.g., "price" → ["price", "cost", "fee", "$", "pricing",
     "rate", "charge", "amount"])
   - Related structural terms (e.g., "date" → ["date", "time", "when",
     "schedule", "calendar", "day", "month", "year"])

6. If the user says "show everything" or "reset", return an empty topics
   array with merge_strategy "REPLACE" to signal a full reset.

INPUT FORMAT:
{
  "transcript": "<the user's spoken words>",
  "prior_intent": <the current FocusIntent or null>
}

OUTPUT FORMAT (strict JSON):
{
  "mode": "FOCUS" or "EXCLUDE",
  "topics": [ { "label": "...", "keywords": [...], "semantic_description": "..." } ],
  "merge_strategy": "REPLACE" or "ADD" or "SUBTRACT",
  "confidence": 0.0-1.0,
  "ambiguity_note": "..." or null
}
```

### 9.2 System Prompt — Content Relevance Scorer

This prompt is sent to the Claude API to score content blocks against a focus intent.

```
SYSTEM PROMPT — CONTENT RELEVANCE SCORER

You are the content-relevance scorer for FlowState. Given a user's focus
intent and a list of content blocks extracted from a webpage, score each
block for relevance to the user's focus.

SCORING GUIDELINES:

Score 0.9–1.0 (DIRECTLY RELEVANT):
  The block's text explicitly discusses one of the focus topics.
  It contains keywords or directly answers the user's information need.
  Examples: a paragraph about event times when user asked for "timings",
  a price table when user asked for "costs".

Score 0.7–0.89 (CONTEXTUALLY RELEVANT):
  The block provides important supporting context for a focus topic.
  It may be a heading above relevant content, an introduction to a
  relevant section, or metadata associated with relevant content.
  Examples: the heading "Event Details" above a relevant paragraph,
  an image caption describing the venue.

Score 0.4–0.69 (TANGENTIALLY RELATED):
  The block shares some thematic overlap but is not what the user
  specifically asked for. It might mention a focus keyword in passing
  or belong to a broader section that contains relevant content.
  Examples: a general event overview paragraph when user asked
  specifically for "times", a related-events sidebar.

Score 0.15–0.39 (STRUCTURAL / NOT RELEVANT):
  The block is structural (navigation, site header, footer) or
  discusses a completely different topic. It should be visible enough
  to maintain spatial orientation but not draw attention.
  Examples: main site navigation, social media links, copyright notice.

Score 0.0–0.14 (IRRELEVANT / DISTRACTING):
  The block is an advertisement, cookie banner, unrelated promotional
  content, or completely off-topic material that would distract
  from the focused content.

SPECIAL RULES:
- Navigation elements: default 0.3 unless the user's focus explicitly
  involves navigation.
- Page title / site header: always at least 0.5 (provides orientation).
- If the focus mode is "EXCLUDE", invert the logic: blocks matching
  the topics should score LOW, everything else scores HIGH.

INPUT FORMAT:
{
  "intent": { <FocusIntent object> },
  "blocks": [
    {
      "id": "...",
      "element_type": "...",
      "text_content": "...",
      "context": { "parent_heading": "...", "section_path": [...], "surrounding_text": "..." },
      "structural_role": "..."
    }
  ]
}

OUTPUT FORMAT (strict JSON):
{
  "scores": [
    { "id": "block_id", "score": 0.0-1.0, "reasoning": "one short sentence" }
  ]
}
```

### 9.3 Prompt Chaining Logic

The complete pipeline for handling a single voice command:

```
ROUTINE: HandleVoiceCommand(transcript, session)

1. INTERPRET
   input  = { transcript: transcript, prior_intent: session.active_intent }
   result = call_claude_api(SEMANTIC_INTERPRETER_PROMPT, input)
   intent = parse(result) as FocusIntent

2. CHECK AMBIGUITY
   if intent.confidence < 0.7:
     show_to_user(intent.ambiguity_note)
     wait_for_clarification()
     → restart from step 1 with clarified transcript

3. CHECK RESET
   if intent.topics is empty and intent.merge_strategy == "REPLACE":
     reset_all_styles(session)
     session.is_active = false
     return

4. MERGE INTENT
   if intent.merge_strategy == "ADD":
     session.active_intent.topics += intent.topics
   elif intent.merge_strategy == "SUBTRACT":
     session.active_intent.topics -= semantically_overlapping(intent.topics)
   elif intent.merge_strategy == "REPLACE":
     session.active_intent = intent
   session.history.append(intent)

5. EXTRACT CONTENT
   blocks = extract_content_blocks(session.page_dom)
   // Tag each block with id, text, context, structural_role

6. SCORE
   batches = chunk(blocks, size=50)
   scored_map = {}
   for batch in batches:
     input = { intent: session.active_intent, blocks: batch }
     result = call_claude_api(CONTENT_SCORER_PROMPT, input)
     scored_map.merge(parse(result).scores)

7. PROPAGATE SCORES
   apply_score_propagation_rules(scored_map, page_dom)
   // heading influence, container inheritance, etc.

8. TRANSFORM
   for block_id, { score } in scored_map:
     element = get_dom_element(block_id)
     apply_visual_treatment(element, score)
   // All changes applied with CSS transitions

9. SCROLL TO FOCUS
   first_relevant = find_first_block_with_score(scored_map, threshold=0.9)
   if first_relevant:
     smooth_scroll_to(first_relevant, offset="33vh")

10. UPDATE STATE
    session.scored_map = scored_map
    session.is_active = true
```

---

## 10. Example Scenarios

### Scenario 1: Event Page — Focus on Location and Timings

**Page:** A community event page with sections for Overview, Schedule, Venue & Directions, Speakers, Sponsors, Registration, FAQ, and a sidebar with ads and social links.

**User says:** "Only show information about the event location and timings"

**Stage 2 — Interpreted Intent:**
```json
{
  "mode": "FOCUS",
  "topics": [
    {
      "label": "event location",
      "keywords": ["location", "venue", "address", "where", "place", "map", "directions", "parking"],
      "semantic_description": "Information about where the event is physically held, including address, venue name, directions, and maps"
    },
    {
      "label": "event timings",
      "keywords": ["time", "timing", "schedule", "when", "start", "end", "duration", "date", "day", "clock", "AM", "PM", "doors open"],
      "semantic_description": "Information about when the event occurs, including dates, start/end times, schedule of activities, and duration"
    }
  ],
  "merge_strategy": "REPLACE",
  "confidence": 0.95,
  "ambiguity_note": null
}
```

**Stage 3 — Scoring Results (abbreviated):**

| Block | Content (excerpt) | Score | Reasoning |
|---|---|---|---|
| `h2#schedule` | "Event Schedule" | 0.95 | Heading directly matches "timings" topic |
| `div#schedule-table` | "10:00 AM — Doors Open..." | 1.0 | Contains specific event times |
| `h2#venue` | "Venue & Directions" | 0.95 | Heading directly matches "location" topic |
| `p#venue-address` | "123 Main St, Downtown..." | 1.0 | Contains venue address |
| `div#venue-map` | (embedded map) | 0.9 | Map image in venue section |
| `h2#overview` | "Event Overview" | 0.6 | General section, may contain time/location mentions |
| `p#overview-text` | "Join us for a full day of..." | 0.5 | Mentions "full day" (tangential time reference) |
| `h2#speakers` | "Speakers" | 0.2 | Not related to location or timing |
| `div#speaker-bios` | "Jane Doe is a..." | 0.15 | Irrelevant to focus |
| `h2#sponsors` | "Our Sponsors" | 0.15 | Irrelevant to focus |
| `nav#main-nav` | "Home | Events | About" | 0.3 | Structural navigation |
| `aside#sidebar-ads` | "Buy tickets to..." | 0.05 | Advertisement, distracting |
| `footer#site-footer` | "© 2026 EventCo" | 0.15 | Structural footer |

**Stage 4 — Visual Result:**
- The "Event Schedule" and "Venue & Directions" sections are fully visible with accent borders.
- The "Event Overview" is moderately dimmed.
- Speakers, Sponsors, FAQ are heavily dimmed and slightly blurred.
- Navigation is lightly dimmed.
- Sidebar ads are near-invisible.
- The viewport scrolls to the "Event Schedule" heading.

---

### Scenario 2: Recipe Page — Focus on Ingredients

**Page:** A food blog recipe page with a long personal story at the top, followed by the recipe card with ingredients, instructions, nutrition info, and a comment section.

**User says:** "Just the ingredients"

**Stage 2 — Interpreted Intent:**
```json
{
  "mode": "FOCUS",
  "topics": [
    {
      "label": "recipe ingredients",
      "keywords": ["ingredient", "ingredients", "cup", "tablespoon", "teaspoon", "oz", "gram", "lb", "pinch", "chopped", "diced", "sliced", "flour", "sugar", "salt", "butter", "oil"],
      "semantic_description": "The list of ingredients needed for the recipe, including quantities and preparation notes"
    }
  ],
  "merge_strategy": "REPLACE",
  "confidence": 0.92,
  "ambiguity_note": null
}
```

**Visual Result:**
- The long blog narrative at the top: near-invisible (score ~0.05–0.1).
- The "Ingredients" heading and ingredient list: fully visible with accent border (score 1.0).
- The "Instructions" section: moderately dimmed (score ~0.45, tangentially related — the user may want them next).
- Nutrition info: dimmed (score ~0.3).
- Comments section: near-invisible (score ~0.05).

---

### Scenario 3: Follow-Up Refinement

**Continuing from Scenario 2.**

**User says:** "Also show the cooking instructions"

**Stage 2 — Interpreted Intent:**
```json
{
  "mode": "FOCUS",
  "topics": [
    {
      "label": "cooking instructions",
      "keywords": ["instruction", "step", "method", "directions", "bake", "cook", "stir", "preheat", "mix", "combine", "preparation"],
      "semantic_description": "The step-by-step cooking or preparation instructions for the recipe"
    }
  ],
  "merge_strategy": "ADD",
  "confidence": 0.96,
  "ambiguity_note": null
}
```

**Merged Active Intent:** Now includes both "recipe ingredients" AND "cooking instructions" topics.

**Visual Result:**
- Blog narrative: still near-invisible.
- Ingredients list: still fully visible.
- Instructions section: now fully visible with accent border (promoted from dimmed).
- Nutrition info: still dimmed.
- Comments: still near-invisible.

---

### Scenario 4: News Article — Exclude Distractions

**Page:** A news website article with related stories sidebar, newsletter signup, cookie consent, social share buttons, and inline ads.

**User says:** "Hide all the ads and popups, I just want to read the article"

**Stage 2 — Interpreted Intent:**
```json
{
  "mode": "FOCUS",
  "topics": [
    {
      "label": "main article content",
      "keywords": ["article", "story", "report"],
      "semantic_description": "The primary news article content including headline, byline, body text, and any embedded images or quotes that are part of the story"
    }
  ],
  "merge_strategy": "REPLACE",
  "confidence": 0.90,
  "ambiguity_note": null
}
```

*Note: Even though the user mentioned "hide ads and popups" (exclusionary language), the AI correctly interprets the overall intent as "focus on the article" — the exclusion of ads is implicit in focusing on the main content. This is more robust than trying to enumerate all distracting elements.*

**Visual Result:**
- Article headline, byline, body paragraphs, in-article images: fully visible.
- Article publication date, author bio at end: visible (contextually relevant).
- Related stories sidebar: heavily dimmed.
- Newsletter signup: near-invisible.
- Cookie consent banner: near-invisible.
- Inline ads: near-invisible.
- Social share buttons: heavily dimmed.
- Site navigation: lightly dimmed (maintains orientation).

---

### Scenario 5: Ambiguous Instruction

**Page:** A university course catalog page.

**User says:** "Show me the requirements"

**Stage 2 — Interpreted Intent:**
```json
{
  "mode": "FOCUS",
  "topics": [
    {
      "label": "course requirements",
      "keywords": ["requirement", "prerequisite", "required", "mandatory", "credit", "GPA", "eligibility"],
      "semantic_description": "Prerequisites, eligibility criteria, required courses, credit requirements, or admission requirements"
    }
  ],
  "merge_strategy": "REPLACE",
  "confidence": 0.62,
  "ambiguity_note": "The term 'requirements' could refer to: (1) course prerequisites, (2) degree requirements, (3) admission requirements, or (4) technical/system requirements. I've defaulted to course/degree requirements since this appears to be a course catalog. Please clarify if you meant something else."
}
```

**System Behavior:** Because confidence is below 0.7, the system displays the ambiguity note to the user as a toast/overlay: *"I interpreted 'requirements' as course prerequisites and degree requirements. Tap the mic to clarify if you meant something else."* Then proceeds with the best-guess interpretation while inviting refinement.

---

## 11. Edge Cases & Error Handling

### 11.1 Microphone Permission Denied

- Show a non-intrusive banner: "Microphone access is needed for voice commands."
- Offer a text input fallback: display a text field where the user can type their focus instruction instead.
- The typed instruction enters the pipeline at Stage 2 (skipping Stage 1).

### 11.2 Empty or Unrecognizable Speech

- If the transcript is empty or only contains filler words ("um", "uh", "like"):
  - Show: "I didn't catch a focus instruction. Try saying something like 'Show me the prices' or 'Focus on the schedule.'"
  - Return to idle state.

### 11.3 Page with Very Little Content

- If the page has fewer than 5 content blocks:
  - Skip scoring and show all content at full opacity.
  - Show: "This page doesn't have much content to filter. Everything is visible."

### 11.4 Page Fails to Load

- If the URL returns an error (404, 500, network timeout, CORS block):
  - Show an error state in the viewer with the HTTP status and a human-readable explanation.
  - Keep the URL bar active for the user to try a different URL.

### 11.5 API Timeout or Failure

- **Whisper API failure:** Show "Voice transcription failed. Try again or type your instruction instead." Offer text fallback.
- **Claude API failure:** Show "I'm having trouble analyzing the page right now. Please try again." Do not alter the current visual state.
- **Rate limiting:** If either API returns 429, show "Processing limit reached. Please wait a moment and try again." Implement exponential backoff for automatic retry (max 2 retries).
- Log all errors for debugging.

### 11.6 Non-Text Content Heavy Pages

- For pages dominated by images (e.g., galleries):
  - Score images by alt text, title attributes, filenames, and surrounding captions/headings.
  - If insufficient text metadata exists, score by proximity to relevant text blocks.
  - Show a note: "This page has many images. Scoring is based on available descriptions."

### 11.7 Dynamic / Single-Page App Content

- For pages that load content dynamically (infinite scroll, AJAX sections):
  - The content extraction should observe the DOM at the time of the voice command.
  - Newly loaded content (e.g., lazy-loaded sections) should be re-scored against the active intent when it appears.
  - A mutation observer watches for new DOM nodes and applies scoring/transformation to them automatically.

---

## 12. Accessibility Considerations

### 12.1 Screen Reader Compatibility

- Dimmed elements must NOT have `aria-hidden="true"`. They remain in the accessibility tree.
- Relevant elements (score ≥ 0.9) receive `aria-label` annotations: `"[FlowState: Highlighted] <original label>"`.
- A live region announces state changes: "Focus applied: showing event location and timings. 8 sections dimmed."

### 12.2 Keyboard Navigation

- The mic button is keyboard-focusable and activatable with Enter/Space.
- A keyboard shortcut (configurable, default: Ctrl+Shift+F) toggles the mic.
- Tab order is NOT modified by dimming — all focusable elements remain in their original tab order.
- Dimmed elements with `pointer-events: none` still receive keyboard focus (only pointer interaction is disabled).

### 12.3 Reduced Motion Preference

- If the user's operating system has "reduce motion" enabled:
  - All CSS transitions are replaced with instant style changes (0ms duration).
  - The auto-scroll-to-focus behavior is replaced with an instant jump (no smooth scroll).

### 12.4 Color Contrast

- The accent border on highlighted elements uses a color that meets WCAG 2.1 AA contrast requirements against the page background.
- A default accent color is provided, but users can customize it in settings.

### 12.5 Text Input Fallback

- Users who cannot use a microphone can type their focus instruction in a text field.
- The text field appears when:
  - The user clicks a "Type instead" link near the mic button.
  - Microphone permission is denied.
  - The user presses a keyboard shortcut (default: Ctrl+Shift+T).

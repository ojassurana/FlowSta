# FlowState

An accessibility-focused intelligent webpage viewer for users with ADHD. Load any webpage, speak what you want to focus on, and FlowState dims everything else.

## Setup

```bash
# 1. Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure API keys
cp .env.example .env
# Edit .env with your OpenAI and ElevenLabs API keys

# 4. Run the server
uvicorn backend.main:app --reload --port 8000
```

Open http://localhost:8000 in your browser.

## Usage

1. Enter a URL in the top bar and click **Load**
2. Press the **mic button** (right side) and speak a focus instruction:
   - "Only show the event schedule and location"
   - "Focus on the ingredients list"
   - "Hide the ads, I just want the article"
3. The page dims irrelevant content and highlights what matters
4. Speak again to refine: "Also show the cooking instructions"
5. Click the X button or say "show everything" to reset

**Keyboard shortcuts:**
- `Ctrl+Shift+F` — Toggle mic
- `Ctrl+Shift+T` — Open text input fallback

## Architecture

- **Backend:** Python/FastAPI — proxies webpage fetching, ElevenLabs transcription, and GPT analysis
- **Frontend:** Vanilla HTML/CSS/JS — Shadow DOM page rendering, MediaRecorder audio capture, CSS-based dimming
- **Speech-to-Text:** ElevenLabs Speech-to-Text API
- **AI Analysis:** OpenAI GPT-4o (semantic interpretation + content scoring)

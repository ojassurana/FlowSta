from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.routers import page, transcribe, interpret, score

app = FastAPI(title="FlowState API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(page.router, prefix="/api")
app.include_router(transcribe.router, prefix="/api")
app.include_router(interpret.router, prefix="/api")
app.include_router(score.router, prefix="/api")

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


app.mount("/css", StaticFiles(directory=str(FRONTEND_DIR / "css")), name="css")
app.mount("/js", StaticFiles(directory=str(FRONTEND_DIR / "js")), name="js")


@app.get("/{full_path:path}")
async def serve_frontend(full_path: str = ""):
    file_path = FRONTEND_DIR / full_path
    if full_path and file_path.is_file():
        return FileResponse(file_path)
    return FileResponse(FRONTEND_DIR / "index.html")

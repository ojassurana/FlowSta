import httpx
from fastapi import APIRouter, HTTPException

from backend.models import FetchPageRequest, FetchPageResponse
from backend.services.page_fetcher import fetch_page

router = APIRouter()


@router.post("/fetch-page", response_model=FetchPageResponse)
async def fetch_page_endpoint(req: FetchPageRequest):
    try:
        html, base_url, title = await fetch_page(req.url)
        return FetchPageResponse(html=html, base_url=base_url, title=title)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except httpx.HTTPStatusError as e:
        status = e.response.status_code
        if status == 403:
            raise HTTPException(
                status_code=502,
                detail=(
                    "The target site blocked automated fetch requests (HTTP 403). "
                    "Try another URL or use a publicly accessible page."
                ),
            )
        raise HTTPException(status_code=502, detail=f"Upstream site returned HTTP {status}")
    except TimeoutError:
        raise HTTPException(status_code=504, detail="Page took too long to load")
    except ConnectionError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch page: {e}")

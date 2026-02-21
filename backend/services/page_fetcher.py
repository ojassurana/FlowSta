import httpx
from urllib.parse import quote, unquote, urlparse

from backend.config import get_settings
from backend.services.html_sanitizer import sanitize_and_rewrite


async def fetch_page(url: str) -> tuple[str, str, str | None]:
    """Fetch a webpage, sanitize its HTML, and rewrite URLs.

    Returns (sanitized_html, base_url, title).
    """
    settings = get_settings()

    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=httpx.Timeout(settings.page_fetch_timeout),
        verify=False,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
    ) as client:
        response = await client.get(url)
        base_url_override = None

        # Some sites block the first automated request; retry once with more browser-like headers.
        if response.status_code == 403:
            response = await client.get(
                url,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                        "AppleWebKit/605.1.15 (KHTML, like Gecko) "
                        "Version/17.0 Safari/605.1.15"
                    ),
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Cache-Control": "max-age=0",
                    "Pragma": "no-cache",
                    "Upgrade-Insecure-Requests": "1",
                    "Referer": url,
                },
            )

        # Wikipedia occasionally blocks generic fetches; use article HTML API as fallback.
        if response.status_code == 403:
            parsed = urlparse(url)
            host = parsed.netloc.lower()
            path = parsed.path or ""

            if host.endswith("wikipedia.org") and path.startswith("/wiki/"):
                title = path[len("/wiki/") :]
                if title:
                    encoded_title = quote(unquote(title), safe="")
                    wiki_api_url = (
                        f"{parsed.scheme or 'https'}://{parsed.netloc}/api/rest_v1/page/html/{encoded_title}"
                    )
                    response = await client.get(
                        wiki_api_url,
                        headers={
                            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                            "Accept-Language": "en-US,en;q=0.9",
                        },
                    )
                    # Keep relative URL rewriting anchored to the original article URL.
                    base_url_override = url

        response.raise_for_status()

    content_type = response.headers.get("content-type", "")
    if "text/html" not in content_type and "application/xhtml" not in content_type:
        raise ValueError(f"URL did not return HTML (got {content_type})")

    raw_html = response.text
    if len(raw_html) > settings.max_content_length:
        raise ValueError("Page content too large (over 5MB)")

    base_url = base_url_override or str(response.url)
    sanitized_html, title = sanitize_and_rewrite(raw_html, base_url)

    return sanitized_html, base_url, title

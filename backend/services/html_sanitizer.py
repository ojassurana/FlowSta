import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup


def sanitize_and_rewrite(html: str, base_url: str) -> tuple[str, str | None]:
    """Sanitize HTML and rewrite all relative URLs to absolute.

    Returns (sanitized_html, page_title).
    """
    soup = BeautifulSoup(html, "html.parser")

    title_tag = soup.find("title")
    title = title_tag.get_text(strip=True) if title_tag else None

    # Allowlisted script CDN domains (safe rendering libraries)
    SAFE_SCRIPT_DOMAINS = [
        "cdn.jsdelivr.net",
        "cdnjs.cloudflare.com",
        "unpkg.com",
        "polyfill.io",
        "mathjax.org",
        "cdn.mathjax.org",
        "katex.org",
    ]

    # Remove dangerous elements but keep safe CDN scripts
    for tag in soup.find_all("script"):
        src = tag.get("src", "")
        if src and any(domain in src for domain in SAFE_SCRIPT_DOMAINS):
            # Rewrite to absolute if needed
            if not _is_absolute(src):
                tag["src"] = urljoin(base_url, src)
            continue  # Keep this script
        tag.decompose()

    for tag_name in ["object", "embed", "applet"]:
        for tag in soup.find_all(tag_name):
            tag.decompose()

    # Unwrap <noscript> (show their content)
    for tag in soup.find_all("noscript"):
        tag.unwrap()

    # Remove iframes and replace with placeholder
    for tag in soup.find_all("iframe"):
        placeholder = soup.new_tag("div")
        placeholder.string = "[Embedded content removed]"
        placeholder["style"] = (
            "padding:8px;background:#f3f4f6;color:#6b7280;"
            "border:1px dashed #d1d5db;border-radius:4px;font-size:0.875rem;"
        )
        tag.replace_with(placeholder)

    # Remove event handler attributes from all elements
    for tag in soup.find_all(True):
        attrs_to_remove = [attr for attr in tag.attrs if attr.lower().startswith("on")]
        for attr in attrs_to_remove:
            del tag[attr]

    # Strip <meta http-equiv="refresh">
    for meta in soup.find_all("meta", attrs={"http-equiv": re.compile(r"refresh", re.I)}):
        meta.decompose()

    # Remove preload/prefetch link tags
    for link in soup.find_all("link", rel=lambda x: x and any(v in (x if isinstance(x, list) else [x]) for v in ["preload", "prefetch"])):
        link.decompose()

    # Rewrite URL-bearing attributes to absolute
    url_attrs = {
        "a": ["href"],
        "img": ["src"],
        "source": ["src", "srcset"],
        "video": ["src", "poster"],
        "audio": ["src"],
        "link": ["href"],
        "form": ["action"],
    }

    for tag_name, attrs in url_attrs.items():
        for tag in soup.find_all(tag_name):
            for attr in attrs:
                val = tag.get(attr)
                if not val:
                    continue
                if attr == "srcset":
                    tag[attr] = _rewrite_srcset(val, base_url)
                else:
                    if not _is_absolute(val):
                        tag[attr] = urljoin(base_url, val)

    # Rewrite background images in inline styles
    for tag in soup.find_all(style=True):
        tag["style"] = _rewrite_css_urls(tag["style"], base_url)

    # Rewrite url() references inside <style> blocks
    for style_tag in soup.find_all("style"):
        if style_tag.string:
            style_tag.string = _rewrite_css_urls(style_tag.string, base_url)

    # Add target="_blank" and rel="noopener noreferrer" to all links
    for a_tag in soup.find_all("a", href=True):
        a_tag["target"] = "_blank"
        a_tag["rel"] = "noopener noreferrer"

    # Add target="_blank" to forms
    for form_tag in soup.find_all("form"):
        form_tag["target"] = "_blank"

    # Inject <base> tag as safety net
    head = soup.find("head")
    if head:
        existing_base = head.find("base")
        if existing_base:
            existing_base["href"] = base_url
        else:
            base_tag = soup.new_tag("base", href=base_url)
            head.insert(0, base_tag)

    return str(soup), title


def _is_absolute(url: str) -> bool:
    return bool(re.match(r"^(https?://|//|data:|mailto:|tel:|javascript:)", url, re.I))


def _rewrite_srcset(srcset: str, base_url: str) -> str:
    parts = []
    for entry in srcset.split(","):
        entry = entry.strip()
        if not entry:
            continue
        tokens = entry.split()
        if tokens and not _is_absolute(tokens[0]):
            tokens[0] = urljoin(base_url, tokens[0])
        parts.append(" ".join(tokens))
    return ", ".join(parts)


def _rewrite_css_urls(css_text: str, base_url: str) -> str:
    def replacer(match):
        quote = match.group(1) or ""
        path = match.group(2)
        absolute = urljoin(base_url, path)
        return f"url({quote}{absolute}{quote})"

    return re.sub(
        r'url\(\s*(["\']?)(?!data:|https?://|//)([^"\')\s]+)\1\s*\)',
        replacer,
        css_text,
    )

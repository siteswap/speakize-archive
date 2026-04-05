"""Test: every internal href/src in an HTML or JS file points to a real file.

We scan .html and .js sources for hrefs, srcs, and string-literal page
references like 'study.html?lang=...'. For each, we resolve it to a path
on disk (stripping query strings, anchors, encoding), and assert the file
exists.

External URLs (http/https/mailto/data/javascript), in-page anchors (#...),
and dynamic template strings (those containing `' +` or template literals)
are skipped.

Run standalone: python3 tests/test_no_broken_links.py
"""
import re
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]

# Files we parse for link references.
SOURCE_GLOBS = ("*.html", "*.js")

# href="...", src="..." in HTML; also match single-quoted string literals
# inside JS that look like page references.
HREF_RE = re.compile(r'(?:href|src)=["\']([^"\']+)["\']')
JS_PAGE_REF_RE = re.compile(
    r"""['"]([A-Za-z0-9_/\-]+\.(?:html|json|js|css|png|jpg|svg|ico))(?:\?[^'"]*)?['"]"""
)

EXTERNAL_PREFIXES = ("http://", "https://", "//", "mailto:", "data:", "javascript:")


def is_external(url: str) -> bool:
    return url.startswith(EXTERNAL_PREFIXES)


def strip_query_and_fragment(url: str) -> str:
    for ch in ("?", "#"):
        i = url.find(ch)
        if i != -1:
            url = url[:i]
    return url


def looks_like_template(url: str) -> bool:
    # JS-concatenated strings like 'word.html?lang=' leave us a bare path,
    # so that's fine. But patterns like "x' + y + 'z.html" would produce
    # fragments containing '+' or Python-style interpolation — skip those.
    return "{" in url or "}" in url or "+" in url or "<" in url or ">" in url


def collect_references(source_file: Path):
    """Yield (raw_url, resolved_path_relative_to_root) pairs."""
    text = source_file.read_text(errors="replace")
    src_dir = source_file.parent.relative_to(ROOT)
    seen = set()

    def emit(raw):
        if raw in seen:
            return
        seen.add(raw)
        if not raw or is_external(raw) or raw.startswith("#"):
            return
        if looks_like_template(raw):
            return
        path = strip_query_and_fragment(raw)
        if not path or path.startswith("#"):
            return
        path = unquote(path)
        # Resolve relative to the source file's directory.
        resolved = (ROOT / src_dir / path).resolve()
        # Keep only targets inside the project root.
        try:
            rel = resolved.relative_to(ROOT.resolve())
        except ValueError:
            return
        yield raw, rel

    for m in HREF_RE.finditer(text):
        yield from emit(m.group(1))
    if source_file.suffix == ".js":
        for m in JS_PAGE_REF_RE.finditer(text):
            yield from emit(m.group(1))


def gather_sources():
    files = []
    for pattern in SOURCE_GLOBS:
        files.extend(ROOT.glob(pattern))
    # Also scan per-language landing pages and the data dir is irrelevant.
    for sub in ("zh", "es"):
        files.extend((ROOT / sub).glob("*.html"))
    return sorted(f for f in files if f.is_file())


def test_no_broken_internal_links():
    broken = []
    for src in gather_sources():
        for raw, rel in collect_references(src):
            target = ROOT / rel
            # Allow directory refs that have an index.html.
            if target.is_dir():
                if (target / "index.html").exists():
                    continue
            if not target.exists():
                broken.append((src.relative_to(ROOT).as_posix(), raw, rel.as_posix()))
    assert not broken, (
        "Broken internal links:\n  "
        + "\n  ".join(f"{s}: {r!r} -> {p}" for s, r, p in broken)
    )


if __name__ == "__main__":
    try:
        test_no_broken_internal_links()
        print("PASS test_no_broken_internal_links")
    except AssertionError as e:
        print(f"FAIL test_no_broken_internal_links:\n{e}")
        raise SystemExit(1)

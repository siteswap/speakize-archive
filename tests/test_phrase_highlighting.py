"""Test: every zh/es phrase rendered on the site is highlighted with
clickable `.word` anchors (data-name / data-lang), so the word modal works.

Two rendering paths exist:

1. Documents (`document.html` via `document_page.js`) render pre-tokenized
   HTML from `data/documents.json` (the `phrases[*].tokens_html` field).
   Each phrase's tokens_html must already contain `.word` anchors.

2. Flashcard decks (`deck.html`, `study.html`) and `word.html` render
   phrases from `data/zh.json` / `data/es.json` at runtime. They use
   `Speakize.renderTokens()` from the shared `flashcards.js`, which emits
   `.word` anchors with `data-name`/`data-lang`. Each page must route
   `segmented` tokens through that renderer.

All pages must attach the shared word modal via `Speakize.attachWordModal`.

Run standalone: python3 tests/test_phrase_highlighting.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

WORD_ANCHOR_RE = re.compile(
    r'''class=["']word["'][^>]*data-name=["'][^"']+["'][^>]*data-lang=["'][a-z]{2}["']'''
)

# Sources that render zh/es phrases at runtime and therefore must route
# `segmented` tokens through the shared renderer and attach the modal.
# smartfeed.html has its rendering code inline in a <script> block rather
# than in a separate _page.js file, but the contract is the same.
RUNTIME_RENDER_PAGES = [
    "deck_page.js", "study_page.js", "word_page.js", "reports_page.js",
    "smartfeed.html",
]


def _load_docs():
    docs_dir = ROOT / "data" / "documents"
    index = json.loads((docs_dir / "index.json").read_text())
    documents = {}
    for doc_id in index["documents"]:
        documents[doc_id] = json.loads((docs_dir / f"{doc_id}.json").read_text())
    return {**index, "documents": documents}


def test_documents_json_phrases_are_highlighted():
    """Every phrase in every document must have tokens_html with .word anchors."""
    data = _load_docs()
    missing = []
    for doc_id, doc in data["documents"].items():
        for i, p in enumerate(doc.get("phrases") or []):
            tokens_html = p.get("tokens_html", "")
            if not tokens_html.strip():
                continue
            if not WORD_ANCHOR_RE.search(tokens_html):
                missing.append(f"doc {doc_id} phrase[{i}]: {tokens_html[:80]!r}")
    assert not missing, (
        "Phrases in documents.json missing .word anchors:\n  "
        + "\n  ".join(missing[:10])
        + (f"\n  ... and {len(missing) - 10} more" if len(missing) > 10 else "")
    )


def test_documents_json_file_removed():
    """The monolithic data/documents.json should no longer exist."""
    assert not (ROOT / "data" / "documents.json").exists(), (
        "data/documents.json should be replaced by data/documents/ directory"
    )


def test_flashcards_js_emits_word_anchors():
    """flashcards.js must contain a renderTokens that emits .word anchors."""
    js = re.sub(r"\s+", " ", (ROOT / "flashcards.js").read_text())
    assert 'class="word"' in js, "flashcards.js does not emit class=\"word\""
    assert 'data-name="' in js and 'data-lang="' in js, (
        "flashcards.js does not emit data-name/data-lang on .word anchors"
    )
    assert "function renderTokens" in js, (
        "flashcards.js does not define renderTokens"
    )


def test_runtime_pages_route_segmented_through_shared_renderer():
    """deck/study/word pages must call Speakize.renderTokens on segmented tokens."""
    pat = re.compile(r"\.renderTokens\s*\([^)]*segmented")
    for name in RUNTIME_RENDER_PAGES:
        js = (ROOT / name).read_text()
        assert pat.search(js), (
            f"{name} does not call Speakize.renderTokens(...segmented...) — "
            "phrases would render without .word anchors"
        )


def test_all_phrase_pages_attach_shared_modal():
    """Every page that renders phrases attaches the shared word modal."""
    pages = RUNTIME_RENDER_PAGES + ["document_page.js"]
    for name in pages:
        js = (ROOT / name).read_text()
        assert ".attachWordModal" in js, (
            f"{name} does not call attachWordModal"
        )


def test_document_js_handles_pre_rendered_tokens():
    """document_page.js must insert tokens_html as HTML (not escaped text)."""
    js = (ROOT / "document_page.js").read_text()
    assert "tokens_html" in js, "document_page.js does not reference tokens_html"
    assert re.search(r"\+\s*tokens\s*\+|tokens_html\.replace", js), (
        "document_page.js does not appear to insert tokens_html as HTML"
    )


def test_html_pages_load_flashcards_js():
    """Every HTML page that loads a *_page.js must also load flashcards.js first."""
    page_scripts = {
        "deck.html": "deck_page.js",
        "study.html": "study_page.js",
        "word.html": "word_page.js",
        "document.html": "document_page.js",
        "reports.html": "reports_page.js",
    }
    for html_name, js_name in page_scripts.items():
        html = (ROOT / html_name).read_text()
        i_flash = html.find('src="flashcards.js"')
        i_page = html.find(f'src="{js_name}"')
        assert i_flash != -1, f"{html_name} does not load flashcards.js"
        assert i_page != -1, f"{html_name} does not load {js_name}"
        assert i_flash < i_page, (
            f"{html_name}: flashcards.js must be loaded BEFORE {js_name}"
        )


def test_html_pages_do_not_inline_word_modal():
    """The wordModal HTML lives in flashcards.js; pages must not inline it."""
    for html_file in ROOT.glob("*.html"):
        html = html_file.read_text()
        # The modal template literal in flashcards.js is a JS string, not HTML,
        # so only actual HTML `<div ... id="wordModal">` counts.
        assert 'id="wordModal"' not in html, (
            f"{html_file.name} inlines the wordModal — it should be injected "
            "by flashcards.js instead"
        )


if __name__ == "__main__":
    tests = [
        test_documents_json_phrases_are_highlighted,
        test_documents_json_file_removed,
        test_flashcards_js_emits_word_anchors,
        test_runtime_pages_route_segmented_through_shared_renderer,
        test_all_phrase_pages_attach_shared_modal,
        test_document_js_handles_pre_rendered_tokens,
        test_html_pages_load_flashcards_js,
        test_html_pages_do_not_inline_word_modal,
    ]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"PASS {t.__name__}")
        except AssertionError as e:
            failed += 1
            print(f"FAIL {t.__name__}: {e}")
    raise SystemExit(1 if failed else 0)

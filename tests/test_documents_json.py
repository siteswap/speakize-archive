"""Test: every document in data/documents.json has renderable content.

A document renders to an empty page if it has no phrases AND no YouTube embed.
This test catches extraction bugs like the one where rows starting with a
<td><button class="phrase-play">...</td> (rather than an empty <td></td>)
were skipped by the regex.

Run with: python3 -m pytest tests/ -v
Or standalone: python3 tests/test_documents_json.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS_DIR = ROOT / "data" / "documents"


def load():
    """Reconstruct the legacy {myContent, sharedContent, documents: {id: full}}
    shape from the new split layout (index.json + per-doc files)."""
    index = json.loads((DOCS_DIR / "index.json").read_text())
    documents = {}
    for doc_id in index["documents"]:
        documents[doc_id] = json.loads((DOCS_DIR / f"{doc_id}.json").read_text())
    return {
        "myContent": index["myContent"],
        "sharedContent": index["sharedContent"],
        "documents": documents,
    }


def test_lists_are_non_empty():
    """The myContent/sharedContent lists drive documents.html's UI — if
    either is empty, the user sees a blank page."""
    data = load()
    assert data.get("myContent"), "myContent list is empty"
    assert data.get("sharedContent"), "sharedContent list is empty"


def test_every_doc_is_listed():
    """Every document should appear in exactly one of the two lists,
    otherwise documents.html can't link to it."""
    data = load()
    listed = set(data["myContent"]) | set(data["sharedContent"])
    for doc_id in data["documents"]:
        assert doc_id in listed, f"doc {doc_id} is not in any list"


def test_every_listed_doc_exists():
    data = load()
    for list_name in ("myContent", "sharedContent"):
        for doc_id in data[list_name]:
            assert doc_id in data["documents"], (
                f"{list_name} references missing doc id {doc_id}"
            )


def test_every_doc_has_required_fields():
    data = load()
    for doc_id, doc in data["documents"].items():
        assert doc.get("title"), f"doc {doc_id} missing title"
        assert doc.get("lang") in ("zh", "es"), (
            f"doc {doc_id} has invalid lang: {doc.get('lang')!r}"
        )


def test_every_doc_has_renderable_body():
    """A doc must have at least one phrase OR a youtube embed, otherwise
    the rendered page body is empty (just title + legend + back button)."""
    data = load()
    empties = []
    for doc_id, doc in data["documents"].items():
        has_phrases = bool(doc.get("phrases"))
        has_youtube = bool(doc.get("youtube"))
        if not has_phrases and not has_youtube:
            empties.append((doc_id, doc.get("title")))
    assert not empties, (
        "Documents with empty body (no phrases, no youtube): " + repr(empties)
    )


def test_phrase_structure():
    data = load()
    for doc_id, doc in data["documents"].items():
        for i, p in enumerate(doc.get("phrases", [])):
            assert "tokens_html" in p, f"{doc_id} phrase {i} missing tokens_html"
            assert p["tokens_html"], f"{doc_id} phrase {i} has empty tokens_html"
            assert "translation" in p, f"{doc_id} phrase {i} missing translation"
            # tokens_html should contain at least one .word anchor
            assert 'class="word"' in p["tokens_html"], (
                f"{doc_id} phrase {i} has no word tokens: {p['tokens_html'][:80]!r}"
            )


def test_worddata_covers_tokens():
    """Every data-name referenced in phrases should have a wordData entry
    (otherwise the word-click modal silently does nothing)."""
    import html
    import re
    token_re = re.compile(r'data-name="([^"]*)" data-lang="([^"]*)"')
    data = load()
    missing = []
    for doc_id, doc in data["documents"].items():
        wd = doc.get("wordData", {})
        for p in doc.get("phrases", []):
            for name, lang in token_re.findall(p["tokens_html"]):
                # Browsers decode HTML entities in attribute values before
                # exposing them via getAttribute, so decode here too.
                key = lang + "|" + html.unescape(name)
                if key not in wd:
                    missing.append((doc_id, key))
    assert not missing, f"Missing wordData entries: {missing[:10]}"


if __name__ == "__main__":
    tests = [
        test_lists_are_non_empty,
        test_every_doc_is_listed,
        test_every_listed_doc_exists,
        test_every_doc_has_required_fields,
        test_every_doc_has_renderable_body,
        test_phrase_structure,
        test_worddata_covers_tokens,
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

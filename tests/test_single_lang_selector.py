"""Test: each page has at most one zh/es language selector.

The navbar ships a language selector (`wordLookupLang`) on every
authenticated page. In-page forms must not re-introduce their own
language dropdown — that causes two sources of truth and the UI ends
up showing docs in the wrong language. If a page needs to know the
study language, read it from the navbar select / the `study_lang`
localStorage key.

We look for <select> elements containing both an option with value
"zh" and an option with value "es", and require at most one per HTML
file.

Run standalone: python3 tests/test_single_lang_selector.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SELECT_RE = re.compile(r"<select\b[^>]*>(.*?)</select>", re.S | re.I)
OPTION_VAL_RE = re.compile(r'<option[^>]*\bvalue=["\']([^"\']+)["\']', re.I)


def count_lang_selectors(html: str) -> int:
    count = 0
    for m in SELECT_RE.finditer(html):
        values = set(OPTION_VAL_RE.findall(m.group(1)))
        if "zh" in values and "es" in values:
            count += 1
    return count


def test_at_most_one_lang_selector_per_page():
    offenders = []
    for f in sorted(ROOT.glob("*.html")):
        n = count_lang_selectors(f.read_text())
        if n > 1:
            offenders.append((f.name, n))
    assert not offenders, (
        "Pages with multiple zh/es language selectors (use the navbar "
        f"wordLookupLang instead): {offenders}"
    )


if __name__ == "__main__":
    try:
        test_at_most_one_lang_selector_per_page()
        print("PASS test_at_most_one_lang_selector_per_page")
    except AssertionError as e:
        print(f"FAIL test_at_most_one_lang_selector_per_page: {e}")
        raise SystemExit(1)

"""Test: every top-level page ships the same header/navbar.

The landing page (index.html) is excluded — it has login/sign-up UI instead
of the authenticated nav.

The `active` CSS class moves between nav-links depending on which page is
current, so we strip it before comparing.

Run standalone: python3 tests/test_navbar_consistency.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LANDING_PAGES = {"index.html"}
NAV_RE = re.compile(r'<nav class="navbar[^"]*"[^>]*>.*?</nav>', re.S)


def extract_navbar(html: str) -> str | None:
    m = NAV_RE.search(html)
    return m.group(0) if m else None


def normalize(nav: str) -> str:
    # The `active` class is applied to the nav-link for the current page;
    # it's expected to move between pages, so strip it before comparing.
    return nav.replace(" active", "")


def test_every_page_has_a_navbar():
    for f in sorted(ROOT.glob("*.html")):
        if f.name in LANDING_PAGES:
            continue
        nav = extract_navbar(f.read_text())
        assert nav, f"{f.name} has no <nav> element"


def test_navbars_are_identical():
    canonical_name = "documents.html"
    canonical = normalize(extract_navbar((ROOT / canonical_name).read_text()))
    mismatches = []
    for f in sorted(ROOT.glob("*.html")):
        if f.name in LANDING_PAGES or f.name == canonical_name:
            continue
        nav = extract_navbar(f.read_text())
        if nav is None:
            continue  # caught by test_every_page_has_a_navbar
        if normalize(nav) != canonical:
            mismatches.append(f.name)
    assert not mismatches, (
        f"Navbars differ from {canonical_name} in: {mismatches}"
    )


def test_at_most_one_active_nav_link():
    for f in sorted(ROOT.glob("*.html")):
        if f.name in LANDING_PAGES:
            continue
        nav = extract_navbar(f.read_text())
        if nav is None:
            continue
        count = nav.count(' class="nav-link active"')
        assert count <= 1, (
            f"{f.name} has {count} active nav-links (expected 0 or 1)"
        )


if __name__ == "__main__":
    tests = [
        test_every_page_has_a_navbar,
        test_navbars_are_identical,
        test_at_most_one_active_nav_link,
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

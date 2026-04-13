"""One-time split of data/documents.json into data/documents/ layout.

- data/documents/index.json  — {myContent, sharedContent, documents: {id: {title, lang}}}
- data/documents/<id>.json   — full per-document body
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "documents.json"
OUT_DIR = ROOT / "data" / "documents"


def main():
    data = json.loads(SRC.read_text())
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    index = {
        "myContent": data["myContent"],
        "sharedContent": data["sharedContent"],
        "documents": {},
    }
    for doc_id, doc in data["documents"].items():
        index["documents"][doc_id] = {
            "title": doc.get("title"),
            "lang": doc.get("lang"),
        }
        body = {
            "title": doc.get("title"),
            "lang": doc.get("lang"),
            "youtube": doc.get("youtube"),
            "phrases": doc.get("phrases", []),
            "wordData": doc.get("wordData", {}),
        }
        (OUT_DIR / f"{doc_id}.json").write_text(
            json.dumps(body, ensure_ascii=False)
        )

    (OUT_DIR / "index.json").write_text(
        json.dumps(index, ensure_ascii=False)
    )
    SRC.unlink()
    print(f"Wrote {len(index['documents'])} docs + index to {OUT_DIR}")


if __name__ == "__main__":
    main()

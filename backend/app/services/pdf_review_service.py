from pathlib import Path

import fitz


def compare_pdfs(first: Path, second: Path) -> dict[str, object]:
    first_document = fitz.open(first)
    second_document = fitz.open(second)
    try:
        page_count = max(len(first_document), len(second_document))
        changed_pages: list[int] = []
        for index in range(page_count):
            first_text = first_document[index].get_text("text") if index < len(first_document) else ""
            second_text = second_document[index].get_text("text") if index < len(second_document) else ""
            if first_text != second_text:
                changed_pages.append(index)
        return {
            "identical": not changed_pages and len(first_document) == len(second_document),
            "first_page_count": len(first_document),
            "second_page_count": len(second_document),
            "changed_pages": changed_pages,
        }
    finally:
        first_document.close()
        second_document.close()


def redact_pdf(source: Path, destination: Path, terms: list[str]) -> int:
    normalized_terms = [term.strip() for term in terms if term.strip()]
    if not normalized_terms:
        raise ValueError("At least one redaction term is required")
    document = fitz.open(source)
    redaction_count = 0
    try:
        for page in document:
            for term in normalized_terms:
                matches = page.search_for(term)
                redaction_count += len(matches)
                for match in matches:
                    page.add_redact_annot(match, fill=(0, 0, 0))
            page.apply_redactions()
        document.save(destination, garbage=4, deflate=True, clean=True)
        return redaction_count
    finally:
        document.close()

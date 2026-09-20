from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

import fitz


def _markdown_line(line: str) -> str:
    stripped = " ".join(line.split())
    if not stripped:
        return ""
    if len(stripped) <= 80 and (stripped.isupper() or stripped.endswith(":") or stripped.startswith("#")):
        return f"## {stripped.lstrip('# ').rstrip(':')}"
    return stripped


def pdf_to_markdown(source: Path, destination: Path) -> None:
    document = fitz.open(source)
    try:
        lines = ["# OneFile document", ""]
        for index, page in enumerate(document, start=1):
            lines.extend([f"## Page {index}", ""])
            for line in page.get_text("text").splitlines():
                markdown = _markdown_line(line)
                if markdown:
                    lines.extend([markdown, ""])
        destination.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    finally:
        document.close()


def smart_split_pdf(source: Path, destination: Path) -> int:
    document = fitz.open(source)
    try:
        starts = [0]
        for index, page in enumerate(document):
            if index == 0:
                continue
            first_line = next((" ".join(line.split()) for line in page.get_text("text").splitlines() if line.strip()), "")
            if first_line and (first_line.isupper() or first_line.startswith("#")):
                starts.append(index)
        starts.append(len(document))
        with ZipFile(destination, "w", ZIP_DEFLATED) as archive:
            for section, (start, end) in enumerate(zip(starts, starts[1:]), start=1):
                output = fitz.open()
                try:
                    output.insert_pdf(document, from_page=start, to_page=end - 1)
                    section_path = destination.parent / f"section-{section}.pdf"
                    output.save(section_path)
                    archive.write(section_path, arcname=section_path.name)
                finally:
                    output.close()
        return len(starts) - 1
    finally:
        document.close()

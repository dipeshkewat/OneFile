from pathlib import Path

import fitz
from pypdf import PdfReader, PdfWriter


def merge_pdfs(sources: list[Path], destination: Path) -> None:
    writer = PdfWriter()
    for source in sources:
        reader = PdfReader(str(source))
        for page in reader.pages:
            writer.add_page(page)
    with destination.open("wb") as output:
        writer.write(output)


def transform_pdf(source: Path, destination: Path, operation: str, pages: list[int] | None = None, angle: int = 90) -> int:
    document = fitz.open(source)
    try:
        if operation == "rotate":
            for index in pages or range(len(document)):
                document[index].set_rotation((document[index].rotation + angle) % 360)
        elif operation == "delete":
            for index in sorted(pages or [], reverse=True):
                document.delete_page(index)
        elif operation == "reorder":
            document.select(pages or list(range(len(document))))
        document.save(destination, garbage=4, deflate=True)
        return len(document)
    finally:
        document.close()


def compress_pdf(source: Path, destination: Path) -> None:
    document = fitz.open(source)
    try:
        document.save(destination, garbage=4, deflate=True, clean=True)
    finally:
        document.close()


def images_to_pdf(sources: list[Path], destination: Path) -> None:
    document = fitz.open()
    try:
        for source in sources:
            image = fitz.Pixmap(source)
            page = document.new_page(width=image.width, height=image.height)
            page.insert_image(page.rect, filename=str(source))
        document.save(destination)
    finally:
        document.close()
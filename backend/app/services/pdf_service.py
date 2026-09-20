from pathlib import Path
from zipfile import ZipFile

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
        elif operation in {"split", "reorder"}:
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


def pdf_to_images(source: Path, destination: Path) -> None:
    document = fitz.open(source)
    try:
        with ZipFile(destination, "w") as archive:
            for index, page in enumerate(document):
                pixmap = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
                image_name = f"page-{index + 1}.png"
                archive.writestr(image_name, pixmap.tobytes("png"))
    finally:
        document.close()


def watermark_pdf(source: Path, destination: Path, text: str) -> None:
    document = fitz.open(source)
    try:
        for page in document:
            page.insert_text(
                (page.rect.width / 2 - min(page.rect.width / 3, len(text) * 4), page.rect.height / 2),
                text,
                fontsize=24,
                color=(0.55, 0.55, 0.55),
                overlay=True,
            )
        document.save(destination, garbage=4, deflate=True)
    finally:
        document.close()


def add_page_numbers(source: Path, destination: Path, start: int = 1) -> None:
    document = fitz.open(source)
    try:
        for index, page in enumerate(document):
            page.insert_text(
                (page.rect.width / 2 - 8, page.rect.height - 24),
                str(start + index),
                fontsize=10,
                color=(0.25, 0.25, 0.25),
                overlay=True,
            )
        document.save(destination, garbage=4, deflate=True)
    finally:
        document.close()


def crop_pdf(source: Path, destination: Path, left: float, top: float, right: float, bottom: float) -> None:
    document = fitz.open(source)
    try:
        for page in document:
            rect = page.rect
            crop = fitz.Rect(left, top, rect.width - right, rect.height - bottom)
            if crop.width <= 0 or crop.height <= 0:
                raise ValueError("Crop margins leave no page area")
            page.set_cropbox(crop)
        document.save(destination, garbage=4, deflate=True)
    finally:
        document.close()


def protect_pdf(source: Path, destination: Path, password: str) -> None:
    document = fitz.open(source)
    try:
        document.save(
            destination,
            garbage=4,
            deflate=True,
            encryption=fitz.PDF_ENCRYPT_AES_256,
            user_pw=password,
            owner_pw=password,
        )
    finally:
        document.close()


def unlock_pdf(source: Path, destination: Path, password: str) -> None:
    document = fitz.open(source)
    try:
        if document.needs_pass and not document.authenticate(password):
            raise ValueError("The PDF password is incorrect")
        document.save(destination, garbage=4, deflate=True)
    finally:
        document.close()


def repair_pdf(source: Path, destination: Path) -> None:
    document = fitz.open(source)
    try:
        document.save(destination, garbage=4, deflate=True, clean=True)
    finally:
        document.close()
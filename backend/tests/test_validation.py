from fastapi.testclient import TestClient
from io import BytesIO
from zipfile import ZipFile

from PIL import Image
import fitz
from docx import Document

from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_check_file_accepts_png() -> None:
    source = BytesIO()
    Image.new("RGB", (2, 2), color="white").save(source, format="PNG")

    response = client.post(
        "/api/v1/check/file",
        files={"file": ("sample.png", source.getvalue(), "image/png")},
    )

    assert response.status_code == 200
    assert response.json()["valid"] is True
    assert response.json()["temporary_files_removed"] is True


def test_check_image_reports_dimensions_and_requirement_result() -> None:
    source = BytesIO()
    Image.new("RGB", (3, 5), color="white").save(source, format="PNG")

    response = client.post(
        "/api/v1/check/file",
        data={"width": "3", "height": "5", "max_size_kb": "100"},
        files={"file": ("sample.png", source.getvalue(), "image/png")},
    )

    result = response.json()
    assert response.status_code == 200
    assert result["dimensions"] == {"width": 3, "height": 5}
    assert result["requirements_met"] is True


def test_check_image_reports_format_and_resolution_requirements() -> None:
    source = BytesIO()
    Image.new("RGB", (4, 5), color="white").save(source, format="PNG")

    response = client.post(
        "/api/v1/check/file",
        data={"required_format": "png", "resolution": "20"},
        files={"file": ("sample.png", source.getvalue(), "image/png")},
    )

    result = response.json()
    assert response.status_code == 200
    assert result["requirements_met"] is True
    assert {check["name"] for check in result["checks"]} == {"format", "resolution"}


def test_check_file_rejects_mismatched_content() -> None:
    response = client.post(
        "/api/v1/check/file",
        files={"file": ("sample.png", b"not-a-png", "image/png")},
    )

    assert response.status_code == 415


def test_check_file_rejects_unsupported_extension() -> None:
    response = client.post(
        "/api/v1/check/file",
        files={"file": ("sample.exe", b"MZ", "application/octet-stream")},
    )

    assert response.status_code == 415


def test_convert_image_returns_resized_png() -> None:
    source = BytesIO()
    Image.new("RGB", (4, 4), color="white").save(source, format="PNG")

    response = client.post(
        "/api/v1/images/convert",
        data={"output_format": "png", "width": "2", "height": "2"},
        files={"file": ("sample.png", source.getvalue(), "image/png")},
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    with Image.open(BytesIO(response.content)) as image:
        assert image.size == (2, 2)


def test_resize_image_returns_requested_dimensions() -> None:
    source = BytesIO()
    Image.new("RGB", (4, 8), color="blue").save(source, format="PNG")

    response = client.post(
        "/api/v1/images/resize",
        data={"width": "3", "height": "2", "crop": "true"},
        files={"file": ("sample.png", source.getvalue(), "image/png")},
    )

    assert response.status_code == 200
    with Image.open(BytesIO(response.content)) as image:
        assert image.size == (3, 2)


def test_image_auto_fix_returns_requested_jpeg_dimensions() -> None:
    source = BytesIO()
    Image.new("RGB", (20, 30), color="blue").save(source, format="PNG")

    response = client.post(
        "/api/v1/images/auto-fix",
        data={"output_format": "jpg", "width": "10", "height": "12", "target_kb": "100"},
        files={"file": ("sample.png", source.getvalue(), "image/png")},
    )

    assert response.status_code == 200
    with Image.open(BytesIO(response.content)) as image:
        assert image.format == "JPEG"
        assert image.size == (10, 12)
    assert len(response.content) <= 100 * 1024


def test_batch_image_conversion_returns_zip() -> None:
    first = BytesIO()
    second = BytesIO()
    Image.new("RGB", (10, 10), color="red").save(first, format="PNG")
    Image.new("RGB", (10, 10), color="green").save(second, format="PNG")

    response = client.post(
        "/api/v1/images/batch",
        data={"operation": "convert", "output_format": "webp"},
        files=[
            ("files", ("first.png", first.getvalue(), "image/png")),
            ("files", ("second.png", second.getvalue(), "image/png")),
        ],
    )

    assert response.status_code == 200
    with ZipFile(BytesIO(response.content)) as archive:
        assert sorted(archive.namelist()) == ["first.webp", "second.webp"]


def test_pdf_rotate_returns_pdf() -> None:
    source = BytesIO()
    document = fitz.open()
    document.new_page(width=200, height=200)
    document.save(source)
    document.close()

    response = client.post(
        "/api/v1/pdfs/rotate",
        data={"angle": "90"},
        files={"file": ("sample.pdf", source.getvalue(), "application/pdf")},
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    result = fitz.open(stream=response.content, filetype="pdf")
    assert len(result) == 1
    result.close()


def test_pdf_delete_removes_requested_page() -> None:
    source = BytesIO()
    document = fitz.open()
    document.new_page(width=200, height=200)
    document.new_page(width=200, height=200)
    document.save(source)
    document.close()

    response = client.post(
        "/api/v1/pdfs/pages/delete",
        data={"pages": "0"},
        files={"file": ("sample.pdf", source.getvalue(), "application/pdf")},
    )

    assert response.status_code == 200
    result = fitz.open(stream=response.content, filetype="pdf")
    assert len(result) == 1
    result.close()


def test_pdf_to_images_returns_zip() -> None:
    source = BytesIO()
    document = fitz.open()
    document.new_page(width=200, height=200)
    document.save(source)
    document.close()

    response = client.post(
        "/api/v1/pdfs/to-images",
        files={"file": ("sample.pdf", source.getvalue(), "application/pdf")},
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"


def test_images_to_pdf_returns_pdf() -> None:
    first = BytesIO()
    second = BytesIO()
    Image.new("RGB", (10, 10), color="red").save(first, format="PNG")
    Image.new("RGB", (10, 10), color="green").save(second, format="PNG")

    response = client.post(
        "/api/v1/images/to-pdf",
        files=[
            ("files", ("first.png", first.getvalue(), "image/png")),
            ("files", ("second.png", second.getvalue(), "image/png")),
        ],
    )

    assert response.status_code == 200
    document = fitz.open(stream=response.content, filetype="pdf")
    assert len(document) == 2
    document.close()


def test_document_conversion_supports_docx_to_pdf() -> None:
    source = BytesIO()
    document = Document()
    document.add_paragraph("OneFile document conversion")
    document.save(source)

    response = client.post(
        "/api/v1/documents/convert",
        data={"output_format": "pdf"},
        files={
            "file": (
                "sample.docx",
                source.getvalue(),
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"


def test_document_conversion_supports_pdf_to_docx() -> None:
    source = BytesIO()
    document = fitz.open()
    page = document.new_page(width=200, height=200)
    page.insert_text((40, 40), "OneFile document conversion")
    document.save(source)
    document.close()

    response = client.post(
        "/api/v1/documents/convert",
        data={"output_format": "docx"},
        files={"file": ("sample.pdf", source.getvalue(), "application/pdf")},
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

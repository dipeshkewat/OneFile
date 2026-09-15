from fastapi.testclient import TestClient
from io import BytesIO

from PIL import Image

from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_check_file_accepts_png() -> None:
    response = client.post(
        "/api/v1/check/file",
        files={"file": ("sample.png", b"\x89PNG\r\n\x1a\nvalid", "image/png")},
    )

    assert response.status_code == 200
    assert response.json()["valid"] is True
    assert response.json()["temporary_files_removed"] is True


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

from pathlib import Path
from uuid import uuid4

import fitz
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError

from app.core.limits import SUPPORTED_EXTENSIONS, SUPPORTED_MEDIA_TYPES, max_file_size_bytes
from app.utils.file_signatures import detect_file_type
from app.utils.temp_files import isolated_temp_directory

router = APIRouter(tags=["validation"])


@router.post("/check/file")
async def check_file(
    file: UploadFile = File(...),
    max_size_kb: int | None = Form(default=None, ge=1),
    width: int | None = Form(default=None, ge=1),
    height: int | None = Form(default=None, ge=1),
    page_count: int | None = Form(default=None, ge=1),
) -> dict[str, object]:
    filename = Path(file.filename or "upload").name
    extension = Path(filename).suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Unsupported file extension")
    if file.content_type not in SUPPORTED_MEDIA_TYPES:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Unsupported media type")

    with isolated_temp_directory() as directory:
        stored_path = directory / f"{uuid4().hex}{extension}"
        size = 0
        with stored_path.open("wb") as destination:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > max_file_size_bytes():
                    raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File exceeds the configured size limit")
                destination.write(chunk)

        detected = detect_file_type(stored_path)
        if detected is None or detected[0] != file.content_type or detected[1] != (".jpg" if extension == ".jpeg" else extension):
            raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="File content does not match its declared type")

        checks: list[dict[str, object]] = []
        if max_size_kb is not None:
            checks.append({"name": "maximum size", "passed": size <= max_size_kb * 1024, "actual": size, "expected": max_size_kb * 1024})
        if detected[0].startswith("image/"):
            try:
                with Image.open(stored_path) as image:
                    actual_width, actual_height = image.size
            except UnidentifiedImageError as error:
                raise HTTPException(status_code=422, detail="The image could not be decoded") from error
            if width is not None:
                checks.append({"name": "width", "passed": actual_width == width, "actual": actual_width, "expected": width})
            if height is not None:
                checks.append({"name": "height", "passed": actual_height == height, "actual": actual_height, "expected": height})
            dimensions = {"width": actual_width, "height": actual_height}
            pages = None
        else:
            document = fitz.open(stored_path)
            pages = len(document)
            document.close()
            dimensions = None
            if page_count is not None:
                checks.append({"name": "page count", "passed": pages == page_count, "actual": pages, "expected": page_count})

        return {
            "valid": True,
            "filename": filename,
            "media_type": detected[0],
            "size_bytes": size,
            "dimensions": dimensions,
            "page_count": pages,
            "checks": checks,
            "requirements_met": all(check["passed"] for check in checks),
            "temporary_files_removed": True,
        }

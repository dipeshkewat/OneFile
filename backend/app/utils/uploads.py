from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

from app.core.limits import max_file_size_bytes
from app.utils.file_signatures import detect_file_type


async def save_upload(file: UploadFile, directory: Path, allowed_extensions: set[str]) -> tuple[Path, int, str]:
    filename = Path(file.filename or "upload").name
    extension = Path(filename).suffix.lower()
    if extension not in allowed_extensions:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Unsupported file type")

    target = directory / f"{uuid4().hex}{extension}"
    size = 0
    with target.open("wb") as destination:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > max_file_size_bytes():
                raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File exceeds the configured size limit")
            destination.write(chunk)

    detected = detect_file_type(target)
    expected_extension = ".jpg" if extension == ".jpeg" else extension
    if detected is None or detected[0] != file.content_type or detected[1] != expected_extension:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="File content does not match its declared type")
    return target, size, filename
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.core.limits import SUPPORTED_EXTENSIONS, SUPPORTED_MEDIA_TYPES, max_file_size_bytes
from app.utils.file_signatures import detect_file_type
from app.utils.temp_files import isolated_temp_directory

router = APIRouter(tags=["validation"])


@router.post("/check/file")
async def check_file(file: UploadFile = File(...)) -> dict[str, object]:
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

        return {
            "valid": True,
            "filename": filename,
            "media_type": detected[0],
            "size_bytes": size,
            "temporary_files_removed": True,
        }

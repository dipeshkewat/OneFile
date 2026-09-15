import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.core.limits import SUPPORTED_EXTENSIONS, SUPPORTED_MEDIA_TYPES, max_file_size_bytes
from app.services.image_service import convert_image
from app.utils.file_signatures import detect_file_type
from app.utils.temp_files import isolated_temp_directory

router = APIRouter(prefix="/images", tags=["images"])


@router.post("/convert")
async def convert(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    output_format: str = Form(...),
    width: int | None = Form(default=None, ge=1, le=10000),
    height: int | None = Form(default=None, ge=1, le=10000),
) -> FileResponse:
    filename = Path(file.filename or "upload").name
    extension = Path(filename).suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS - {".pdf"} or file.content_type not in SUPPORTED_MEDIA_TYPES - {"application/pdf"}:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="An image upload is required")

    directory = Path()
    temporary_context = isolated_temp_directory()
    directory = temporary_context.__enter__()
    try:
        source = directory / f"{uuid4().hex}{extension}"
        size = 0
        with source.open("wb") as destination:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > max_file_size_bytes():
                    raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File exceeds the configured size limit")
                destination.write(chunk)

        detected = detect_file_type(source)
        expected_extension = ".jpg" if extension == ".jpeg" else extension
        if detected is None or detected[0] != file.content_type or detected[1] != expected_extension:
            raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="File content does not match its declared type")

        output_extension = output_format.lower().lstrip(".")
        output = directory / f"converted-{uuid4().hex}.{output_extension}"
        try:
            output_name, media_type = convert_image(source, output, output_extension, width, height)
        except ValueError as error:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error

        background_tasks.add_task(temporary_context.__exit__, None, None, None)
        return FileResponse(output, media_type=media_type, filename=output_name, background=background_tasks)
    except Exception:
        temporary_context.__exit__(None, None, None)
        raise
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.services.image_service import compress_image, convert_image, resize_image
from app.services.pdf_service import images_to_pdf
from app.config import settings
from app.utils.temp_files import isolated_temp_directory
from app.utils.uploads import save_upload

router = APIRouter(prefix="/images", tags=["images"])
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def _cleanup(context, background_tasks: BackgroundTasks) -> None:
    background_tasks.add_task(context.__exit__, None, None, None)


async def _save_image(file: UploadFile, directory: Path) -> tuple[Path, str]:
    source, _, filename = await save_upload(file, directory, IMAGE_EXTENSIONS)
    return source, filename


@router.post("/convert")
async def convert(background_tasks: BackgroundTasks, file: UploadFile = File(...), output_format: str = Form(...), width: int | None = Form(default=None, ge=1, le=10000), height: int | None = Form(default=None, ge=1, le=10000)) -> FileResponse:
    context = isolated_temp_directory()
    directory = context.__enter__()
    try:
        source, _ = await _save_image(file, directory)
        output = directory / f"converted-{uuid4().hex}.{output_format.lower().lstrip('.') }"
        try:
            output_name, media_type = convert_image(source, output, output_format, width, height)
        except ValueError as error:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
        _cleanup(context, background_tasks)
        return FileResponse(output, media_type=media_type, filename=output_name, background=background_tasks)
    except Exception:
        context.__exit__(None, None, None)
        raise


@router.post("/resize")
async def resize(background_tasks: BackgroundTasks, file: UploadFile = File(...), width: int = Form(..., ge=1, le=10000), height: int = Form(..., ge=1, le=10000), crop: bool = Form(False)) -> FileResponse:
    context = isolated_temp_directory()
    directory = context.__enter__()
    try:
        source, _ = await _save_image(file, directory)
        output = directory / f"resized-{uuid4().hex}.jpg"
        resize_image(source, output, width, height, crop)
        _cleanup(context, background_tasks)
        return FileResponse(output, media_type="image/jpeg", filename=output.name, background=background_tasks)
    except Exception:
        context.__exit__(None, None, None)
        raise


@router.post("/crop")
async def crop(background_tasks: BackgroundTasks, file: UploadFile = File(...), width: int = Form(..., ge=1, le=10000), height: int = Form(..., ge=1, le=10000)) -> FileResponse:
    return await resize(background_tasks, file, width, height, True)


@router.post("/compress")
async def compress(background_tasks: BackgroundTasks, file: UploadFile = File(...), target_kb: int = Form(..., ge=1, le=10240)) -> FileResponse:
    context = isolated_temp_directory()
    directory = context.__enter__()
    try:
        source, _ = await _save_image(file, directory)
        output = directory / f"compressed-{uuid4().hex}.jpg"
        _, media_type, target_met = compress_image(source, output, target_kb)
        if not target_met:
            context.__exit__(None, None, None)
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="The target size cannot be reached above the quality floor")
        _cleanup(context, background_tasks)
        return FileResponse(output, media_type=media_type, filename=output.name, background=background_tasks)
    except Exception:
        context.__exit__(None, None, None)
        raise


@router.post("/to-pdf")
async def to_pdf(background_tasks: BackgroundTasks, files: list[UploadFile] = File(...)) -> FileResponse:
    if not files or len(files) > settings.max_request_files:
        raise HTTPException(status_code=422, detail=f"Upload between 1 and {settings.max_request_files} image files")
    context = isolated_temp_directory()
    directory = context.__enter__()
    try:
        sources = []
        for file in files:
            source, _ = await _save_image(file, directory)
            sources.append(source)
        output = directory / "onefile-images.pdf"
        images_to_pdf(sources, output)
        _cleanup(context, background_tasks)
        return FileResponse(output, media_type="application/pdf", filename=output.name, background=background_tasks)
    except Exception:
        context.__exit__(None, None, None)
        raise

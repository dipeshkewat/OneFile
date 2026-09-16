from pathlib import Path
from uuid import uuid4
from zipfile import ZipFile

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.services.image_service import auto_fix_image, compress_image, convert_image, resize_image
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


@router.post("/auto-fix")
async def auto_fix(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    output_format: str = Form(...),
    width: int | None = Form(default=None, ge=1, le=10000),
    height: int | None = Form(default=None, ge=1, le=10000),
    target_kb: int | None = Form(default=None, ge=1, le=10240),
) -> FileResponse:
    normalized_format = output_format.lower().lstrip(".")
    context = isolated_temp_directory()
    directory = context.__enter__()
    try:
        source, _ = await _save_image(file, directory)
        output = directory / f"auto-fixed-{uuid4().hex}.{normalized_format}"
        try:
            output_name, media_type, target_met = auto_fix_image(source, output, normalized_format, width, height, target_kb)
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        if not target_met:
            raise HTTPException(status_code=422, detail="The requested image size cannot be reached with the quality floor")
        _cleanup(context, background_tasks)
        return FileResponse(output, media_type=media_type, filename=output_name, background=background_tasks)
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


@router.post("/batch")
async def batch(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    operation: str = Form(...),
    output_format: str = Form("png"),
    target_kb: int | None = Form(default=None, ge=1, le=10240),
    width: int | None = Form(default=None, ge=1, le=10000),
    height: int | None = Form(default=None, ge=1, le=10000),
) -> FileResponse:
    if not files or len(files) > settings.max_request_files:
        raise HTTPException(status_code=422, detail=f"Upload between 1 and {settings.max_request_files} image files")
    if operation not in {"compress", "convert", "resize", "auto-fix"}:
        raise HTTPException(status_code=422, detail="Unsupported batch operation")

    context = isolated_temp_directory()
    directory = context.__enter__()
    try:
        archive_path = directory / "onefile-batch.zip"
        with ZipFile(archive_path, "w") as archive:
            for index, file in enumerate(files, start=1):
                source, original_name = await _save_image(file, directory)
                stem = Path(original_name).stem or f"file-{index}"
                normalized_format = output_format.lower().lstrip(".")
                if operation == "compress":
                    output = directory / f"{stem}.jpg"
                    _, _, target_met = compress_image(source, output, target_kb or 100)
                elif operation == "resize":
                    output = directory / f"{stem}.jpg"
                    resize_image(source, output, width or 1200, height or 1200, True)
                    target_met = True
                elif operation == "convert":
                    output = directory / f"{stem}.{normalized_format}"
                    convert_image(source, output, normalized_format, width, height)
                    target_met = True
                else:
                    output = directory / f"{stem}.{normalized_format}"
                    _, _, target_met = auto_fix_image(source, output, normalized_format, width, height, target_kb)
                if not target_met:
                    raise HTTPException(status_code=422, detail=f"Batch target size could not be reached for {original_name}")
                archive.write(output, arcname=output.name)
        _cleanup(context, background_tasks)
        return FileResponse(archive_path, media_type="application/zip", filename=archive_path.name, background=background_tasks)
    except Exception:
        context.__exit__(None, None, None)
        raise

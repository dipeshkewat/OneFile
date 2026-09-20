from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.services.pdf_service import (
    add_page_numbers,
    compress_pdf,
    crop_pdf,
    merge_pdfs,
    pdf_to_images,
    protect_pdf,
    repair_pdf,
    transform_pdf,
    unlock_pdf,
    watermark_pdf,
)
from app.services.pdf_review_service import compare_pdfs, redact_pdf
from app.config import settings
from app.utils.temp_files import isolated_temp_directory
from app.utils.uploads import save_upload

router = APIRouter(prefix="/pdfs", tags=["pdfs"])


def _cleanup(context, background_tasks: BackgroundTasks) -> None:
    background_tasks.add_task(context.__exit__, None, None, None)


def _pages(value: str) -> list[int]:
    try:
        pages = [int(item.strip()) for item in value.split(",") if item.strip()]
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Pages must be comma-separated zero-based numbers") from error
    if any(page < 0 for page in pages):
        raise HTTPException(status_code=422, detail="Pages must be zero or greater")
    return pages


async def _save_pdf(file: UploadFile, directory: Path) -> Path:
    source, _, _ = await save_upload(file, directory, {".pdf"})
    return source


async def _single_pdf_response(file: UploadFile, operation: str, background_tasks: BackgroundTasks, pages: list[int] | None = None, angle: int = 90) -> FileResponse:
    context = isolated_temp_directory()
    directory = context.__enter__()
    try:
        source = await _save_pdf(file, directory)
        output = directory / f"{operation}-{uuid4().hex}.pdf"
        transform_pdf(source, output, operation, pages, angle)
        _cleanup(context, background_tasks)
        return FileResponse(output, media_type="application/pdf", filename=output.name, background=background_tasks)
    except Exception:
        context.__exit__(None, None, None)
        raise


@router.post("/compress")
async def compress(background_tasks: BackgroundTasks, file: UploadFile = File(...)) -> FileResponse:
    context = isolated_temp_directory()
    directory = context.__enter__()
    try:
        source = await _save_pdf(file, directory)
        output = directory / f"compressed-{uuid4().hex}.pdf"
        compress_pdf(source, output)
        _cleanup(context, background_tasks)
        return FileResponse(output, media_type="application/pdf", filename=output.name, background=background_tasks)
    except Exception:
        context.__exit__(None, None, None)
        raise


@router.post("/merge")
async def merge(background_tasks: BackgroundTasks, files: list[UploadFile] = File(...)) -> FileResponse:
    if len(files) < 2 or len(files) > settings.max_request_files:
        raise HTTPException(status_code=422, detail=f"Upload between 2 and {settings.max_request_files} PDF files")
    context = isolated_temp_directory()
    directory = context.__enter__()
    try:
        sources = [await _save_pdf(file, directory) for file in files]
        output = directory / "merged.pdf"
        merge_pdfs(sources, output)
        _cleanup(context, background_tasks)
        return FileResponse(output, media_type="application/pdf", filename=output.name, background=background_tasks)
    except Exception:
        context.__exit__(None, None, None)
        raise


@router.post("/split")
async def split(background_tasks: BackgroundTasks, file: UploadFile = File(...), pages: str = Form(...)) -> FileResponse:
    return await _single_pdf_response(file, "split", background_tasks, _pages(pages))


@router.post("/rotate")
async def rotate(background_tasks: BackgroundTasks, file: UploadFile = File(...), pages: str = Form(""), angle: int = Form(90)) -> FileResponse:
    return await _single_pdf_response(file, "rotated", background_tasks, _pages(pages) if pages else None, angle)


@router.post("/pages/delete")
async def delete_pages(background_tasks: BackgroundTasks, file: UploadFile = File(...), pages: str = Form(...)) -> FileResponse:
    return await _single_pdf_response(file, "delete", background_tasks, _pages(pages))


@router.post("/pages/reorder")
async def reorder(background_tasks: BackgroundTasks, file: UploadFile = File(...), pages: str = Form(...)) -> FileResponse:
    return await _single_pdf_response(file, "pages-reordered", background_tasks, _pages(pages))


@router.post("/to-images")
async def to_images(background_tasks: BackgroundTasks, file: UploadFile = File(...)) -> FileResponse:
    context = isolated_temp_directory()
    directory = context.__enter__()
    try:
        source = await _save_pdf(file, directory)
        output = directory / "onefile-pages.zip"
        pdf_to_images(source, output)
        _cleanup(context, background_tasks)
        return FileResponse(output, media_type="application/zip", filename=output.name, background=background_tasks)
    except Exception:
        context.__exit__(None, None, None)
        raise


@router.post("/enhance")
async def enhance(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    operation: str = Form(...),
    text: str = Form(""),
    start: int = Form(1, ge=1),
    left: float = Form(0, ge=0),
    top: float = Form(0, ge=0),
    right: float = Form(0, ge=0),
    bottom: float = Form(0, ge=0),
    password: str = Form(""),
) -> FileResponse:
    if operation not in {"watermark", "page-numbers", "crop", "protect", "unlock", "repair"}:
        raise HTTPException(status_code=422, detail="Unsupported PDF enhancement")
    if operation in {"watermark", "protect", "unlock"} and not password and operation != "watermark":
        raise HTTPException(status_code=422, detail="A password is required")
    if operation == "watermark" and not text.strip():
        raise HTTPException(status_code=422, detail="Watermark text is required")

    context = isolated_temp_directory()
    directory = context.__enter__()
    try:
        source = await _save_pdf(file, directory)
        output = directory / f"{operation}-{uuid4().hex}.pdf"
        try:
            if operation == "watermark":
                watermark_pdf(source, output, text.strip())
            elif operation == "page-numbers":
                add_page_numbers(source, output, start)
            elif operation == "crop":
                crop_pdf(source, output, left, top, right, bottom)
            elif operation == "protect":
                protect_pdf(source, output, password)
            elif operation == "unlock":
                unlock_pdf(source, output, password)
            else:
                repair_pdf(source, output)
        except (ValueError, RuntimeError) as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        _cleanup(context, background_tasks)
        return FileResponse(output, media_type="application/pdf", filename=output.name, background=background_tasks)
    except Exception:
        context.__exit__(None, None, None)
        raise


@router.post("/compare")
async def compare(first: UploadFile = File(...), second: UploadFile = File(...)) -> dict[str, object]:
    context = isolated_temp_directory()
    directory = context.__enter__()
    try:
        first_path = await _save_pdf(first, directory)
        second_path = await _save_pdf(second, directory)
        return compare_pdfs(first_path, second_path)
    finally:
        context.__exit__(None, None, None)


@router.post("/redact")
async def redact(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    terms: str = Form(...),
) -> FileResponse:
    context = isolated_temp_directory()
    directory = context.__enter__()
    try:
        source = await _save_pdf(file, directory)
        output = directory / f"redacted-{uuid4().hex}.pdf"
        try:
            redact_pdf(source, output, terms.split(","))
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        _cleanup(context, background_tasks)
        return FileResponse(output, media_type="application/pdf", filename=output.name, background=background_tasks)
    except Exception:
        context.__exit__(None, None, None)
        raise

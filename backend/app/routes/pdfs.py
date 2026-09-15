from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.services.pdf_service import compress_pdf, merge_pdfs, pdf_to_images, transform_pdf
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
    return await _single_pdf_response(file, "pages-deleted", background_tasks, _pages(pages))


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

from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.services.ai_document_service import pdf_to_markdown, smart_split_pdf
from app.utils.temp_files import isolated_temp_directory
from app.utils.uploads import save_upload

router = APIRouter(prefix="/ai", tags=["document intelligence"])


def _cleanup(context, background_tasks: BackgroundTasks) -> None:
    background_tasks.add_task(context.__exit__, None, None, None)


async def _save_pdf(file: UploadFile, directory: Path) -> Path:
    source, _, _ = await save_upload(file, directory, {".pdf"})
    return source


@router.post("/pdf-to-markdown")
async def to_markdown(background_tasks: BackgroundTasks, file: UploadFile = File(...)) -> FileResponse:
    context = isolated_temp_directory()
    directory = context.__enter__()
    try:
        source = await _save_pdf(file, directory)
        output = directory / f"document-{uuid4().hex}.md"
        pdf_to_markdown(source, output)
        _cleanup(context, background_tasks)
        return FileResponse(output, media_type="text/markdown", filename="onefile-document.md", background=background_tasks)
    except Exception:
        context.__exit__(None, None, None)
        raise


@router.post("/smart-split")
async def smart_split(background_tasks: BackgroundTasks, file: UploadFile = File(...)) -> FileResponse:
    context = isolated_temp_directory()
    directory = context.__enter__()
    try:
        source = await _save_pdf(file, directory)
        output = directory / "onefile-smart-split.zip"
        smart_split_pdf(source, output)
        _cleanup(context, background_tasks)
        return FileResponse(output, media_type="application/zip", filename=output.name, background=background_tasks)
    except Exception:
        context.__exit__(None, None, None)
        raise

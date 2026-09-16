from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.services.document_service import docx_to_pdf, pdf_to_docx
from app.utils.temp_files import isolated_temp_directory
from app.utils.uploads import save_upload

router = APIRouter(prefix="/documents", tags=["documents"])
DOCUMENT_EXTENSIONS = {".docx", ".pdf"}


def _cleanup(context, background_tasks: BackgroundTasks) -> None:
    background_tasks.add_task(context.__exit__, None, None, None)


@router.post("/convert")
async def convert(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    output_format: str = Form(...),
) -> FileResponse:
    normalized_format = output_format.lower().lstrip(".")
    if normalized_format not in {"docx", "pdf"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Output format must be DOCX or PDF")

    context = isolated_temp_directory()
    directory = context.__enter__()
    try:
        source, _, original_name = await save_upload(file, directory, DOCUMENT_EXTENSIONS)
        source_format = Path(original_name).suffix.lower().lstrip(".")
        if source_format == normalized_format:
            raise HTTPException(status_code=422, detail="Choose a different output format")

        output = directory / f"converted-{uuid4().hex}.{normalized_format}"
        if source_format == "docx" and normalized_format == "pdf":
            docx_to_pdf(source, output)
        elif source_format == "pdf" and normalized_format == "docx":
            pdf_to_docx(source, output)
        else:
            raise HTTPException(status_code=422, detail="This document conversion is not supported")

        _cleanup(context, background_tasks)
        media_type = "application/pdf" if normalized_format == "pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        return FileResponse(output, media_type=media_type, filename=output.name, background=background_tasks)
    except Exception:
        context.__exit__(None, None, None)
        raise

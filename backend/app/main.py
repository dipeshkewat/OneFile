from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes.images import router as image_router
from app.routes.pdfs import router as pdf_router
from app.routes.documents import router as document_router
from app.routes.validation import router as validation_router

app = FastAPI(
    title="OneFile API",
    version="0.1.0",
    description="Secure file preparation and validation API.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(validation_router, prefix="/api/v1")
app.include_router(image_router, prefix="/api/v1")
app.include_router(pdf_router, prefix="/api/v1")
app.include_router(document_router, prefix="/api/v1")


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok"}

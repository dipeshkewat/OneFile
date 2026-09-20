from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.config import settings
from app.services.platform_service import PlatformStore

router = APIRouter(prefix="/platform", tags=["platform"])
store = PlatformStore(settings.metadata_db)


class PresetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    tool: str = Field(min_length=1, max_length=100)
    configuration: dict[str, Any]


class HistoryCreate(BaseModel):
    tool: str = Field(min_length=1, max_length=100)
    input_name: str = Field(min_length=1, max_length=255)
    output_name: str = Field(min_length=1, max_length=255)
    status: str = Field(min_length=1, max_length=30)


@router.get("/presets")
def list_presets() -> list[dict[str, object]]:
    return store.list_presets()


@router.post("/presets", status_code=status.HTTP_201_CREATED)
def create_preset(payload: PresetCreate) -> dict[str, object]:
    return store.create_preset(payload.name.strip(), payload.tool.strip(), payload.configuration)


@router.delete("/presets/{preset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_preset(preset_id: str) -> None:
    if not store.delete_preset(preset_id):
        raise HTTPException(status_code=404, detail="Preset not found")


@router.get("/history")
def list_history(limit: int = Query(50, ge=1, le=100)) -> list[dict[str, object]]:
    return store.list_history(limit)


@router.post("/history", status_code=status.HTTP_201_CREATED)
def record_history(payload: HistoryCreate) -> dict[str, object]:
    return store.record_history(payload.tool.strip(), payload.input_name.strip(), payload.output_name.strip(), payload.status.strip())

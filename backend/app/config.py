import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    allowed_origins: list[str]
    max_file_size_bytes: int
    max_request_files: int
    temp_root: str


def _csv_setting(name: str, default: str) -> list[str]:
    return [value.strip() for value in os.getenv(name, default).split(",") if value.strip()]


settings = Settings(
    allowed_origins=_csv_setting("ONEFILE_ALLOWED_ORIGINS", "http://localhost:5173"),
    max_file_size_bytes=int(os.getenv("ONEFILE_MAX_FILE_SIZE_BYTES", str(10 * 1024 * 1024))),
    max_request_files=int(os.getenv("ONEFILE_MAX_REQUEST_FILES", "5")),
    temp_root=os.getenv("ONEFILE_TEMP_ROOT", ""),
)

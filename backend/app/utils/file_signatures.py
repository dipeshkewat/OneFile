from pathlib import Path

SIGNATURES = {
    "jpeg": (b"\xff\xd8\xff", ".jpg"),
    "png": (b"\x89PNG\r\n\x1a\n", ".png"),
    "webp": (b"RIFF", ".webp"),
    "pdf": (b"%PDF-", ".pdf"),
}


def detect_file_type(path: Path) -> tuple[str, str] | None:
    with path.open("rb") as source:
        header = source.read(12)

    if header.startswith(SIGNATURES["jpeg"][0]):
        return "image/jpeg", ".jpg"
    if header.startswith(SIGNATURES["png"][0]):
        return "image/png", ".png"
    if header.startswith(SIGNATURES["pdf"][0]):
        return "application/pdf", ".pdf"
    if header.startswith(SIGNATURES["webp"][0]) and header[8:12] == b"WEBP":
        return "image/webp", ".webp"
    return None

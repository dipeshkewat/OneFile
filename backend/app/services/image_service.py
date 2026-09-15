from pathlib import Path

from PIL import Image, UnidentifiedImageError


FORMAT_CONFIG = {
    "jpg": ("JPEG", "image/jpeg"),
    "jpeg": ("JPEG", "image/jpeg"),
    "png": ("PNG", "image/png"),
    "webp": ("WEBP", "image/webp"),
}


def convert_image(source: Path, destination: Path, output_format: str, width: int | None, height: int | None) -> tuple[str, str]:
    normalized_format = output_format.lower().lstrip(".")
    if normalized_format not in FORMAT_CONFIG:
        raise ValueError("Unsupported output image format")

    format_name, media_type = FORMAT_CONFIG[normalized_format]
    try:
        with Image.open(source) as image:
            if width is not None or height is not None:
                image.thumbnail((width or image.width, height or image.height), Image.Resampling.LANCZOS)
            if format_name == "JPEG" and image.mode in {"RGBA", "LA", "P"}:
                image = image.convert("RGB")
            image.save(destination, format=format_name)
    except UnidentifiedImageError as error:
        raise ValueError("The uploaded content is not a readable image") from error

    return destination.name, media_type
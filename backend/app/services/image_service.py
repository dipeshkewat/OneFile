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


def resize_image(source: Path, destination: Path, width: int, height: int, crop: bool = False) -> tuple[str, str]:
    with Image.open(source) as image:
        if crop:
            source_ratio = image.width / image.height
            target_ratio = width / height
            if source_ratio > target_ratio:
                crop_width = int(image.height * target_ratio)
                left = (image.width - crop_width) // 2
                image = image.crop((left, 0, left + crop_width, image.height))
            else:
                crop_height = int(image.width / target_ratio)
                top = (image.height - crop_height) // 2
                image = image.crop((0, top, image.width, top + crop_height))
        image = image.resize((width, height), Image.Resampling.LANCZOS)
        if image.mode in {"RGBA", "LA", "P"}:
            image = image.convert("RGB")
        image.save(destination, format="JPEG", quality=90)
    return destination.name, "image/jpeg"


def compress_image(source: Path, destination: Path, target_kb: int, minimum_quality: int = 35) -> tuple[str, str, bool]:
    with Image.open(source) as image:
        if image.mode in {"RGBA", "LA", "P"}:
            image = image.convert("RGB")
        low, high = minimum_quality, 95
        best_quality = minimum_quality
        while low <= high:
            quality = (low + high) // 2
            image.save(destination, format="JPEG", quality=quality, optimize=True)
            if destination.stat().st_size <= target_kb * 1024:
                best_quality = quality
                low = quality + 1
            else:
                high = quality - 1
        image.save(destination, format="JPEG", quality=best_quality, optimize=True)
    return destination.name, "image/jpeg", destination.stat().st_size <= target_kb * 1024


def auto_fix_image(
    source: Path,
    destination: Path,
    output_format: str,
    width: int | None,
    height: int | None,
    target_kb: int | None,
) -> tuple[str, str, bool]:
    normalized_format = output_format.lower().lstrip(".")
    if normalized_format not in FORMAT_CONFIG:
        raise ValueError("Unsupported output image format")
    if width is None and height is None and target_kb is None:
        raise ValueError("At least one image requirement is required")

    with Image.open(source) as image:
        if width is not None and height is not None:
            source_ratio = image.width / image.height
            target_ratio = width / height
            if source_ratio > target_ratio:
                crop_width = int(image.height * target_ratio)
                left = (image.width - crop_width) // 2
                image = image.crop((left, 0, left + crop_width, image.height))
            else:
                crop_height = int(image.width / target_ratio)
                top = (image.height - crop_height) // 2
                image = image.crop((0, top, image.width, top + crop_height))
            image = image.resize((width, height), Image.Resampling.LANCZOS)
        elif width is not None or height is not None:
            image.thumbnail((width or image.width, height or image.height), Image.Resampling.LANCZOS)

        format_name, media_type = FORMAT_CONFIG[normalized_format]
        if format_name == "JPEG" and image.mode in {"RGBA", "LA", "P"}:
            image = image.convert("RGB")
        if format_name == "JPEG" and target_kb is not None:
            image.save(destination, format=format_name, quality=95, optimize=True)
            low, high = 35, 95
            best_quality = 35
            while low <= high:
                quality = (low + high) // 2
                image.save(destination, format=format_name, quality=quality, optimize=True)
                if destination.stat().st_size <= target_kb * 1024:
                    best_quality = quality
                    low = quality + 1
                else:
                    high = quality - 1
            image.save(destination, format=format_name, quality=best_quality, optimize=True)
        else:
            image.save(destination, format=format_name, optimize=True)

    return destination.name, media_type, target_kb is None or destination.stat().st_size <= target_kb * 1024
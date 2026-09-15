from contextlib import contextmanager
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Iterator

from app.config import settings


@contextmanager
def isolated_temp_directory() -> Iterator[Path]:
    with TemporaryDirectory(prefix="onefile-", dir=settings.temp_root or None) as directory:
        yield Path(directory)

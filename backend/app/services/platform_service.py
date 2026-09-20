import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


class PlatformStore:
    def __init__(self, database_path: str) -> None:
        self.database_path = Path(database_path)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS presets (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    tool TEXT NOT NULL,
                    configuration TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS history (
                    id TEXT PRIMARY KEY,
                    tool TEXT NOT NULL,
                    input_name TEXT NOT NULL,
                    output_name TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                """
            )

    def list_presets(self) -> list[dict[str, object]]:
        with self._connect() as connection:
            rows = connection.execute("SELECT * FROM presets ORDER BY updated_at DESC").fetchall()
        return [self._preset(row) for row in rows]

    def create_preset(self, name: str, tool: str, configuration: dict[str, object]) -> dict[str, object]:
        now = datetime.now(timezone.utc).isoformat()
        preset = {"id": str(uuid4()), "name": name, "tool": tool, "configuration": configuration, "created_at": now, "updated_at": now}
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO presets (id, name, tool, configuration, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                (preset["id"], name, tool, json.dumps(configuration), now, now),
            )
        return preset

    def delete_preset(self, preset_id: str) -> bool:
        with self._connect() as connection:
            result = connection.execute("DELETE FROM presets WHERE id = ?", (preset_id,))
        return result.rowcount == 1

    def list_history(self, limit: int = 50) -> list[dict[str, object]]:
        with self._connect() as connection:
            rows = connection.execute("SELECT * FROM history ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
        return [dict(row) for row in rows]

    def record_history(self, tool: str, input_name: str, output_name: str, status: str) -> dict[str, object]:
        entry = {"id": str(uuid4()), "tool": tool, "input_name": input_name, "output_name": output_name, "status": status, "created_at": datetime.now(timezone.utc).isoformat()}
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO history (id, tool, input_name, output_name, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                tuple(entry.values()),
            )
        return entry

    @staticmethod
    def _preset(row: sqlite3.Row) -> dict[str, object]:
        result = dict(row)
        result["configuration"] = json.loads(str(result["configuration"]))
        return result

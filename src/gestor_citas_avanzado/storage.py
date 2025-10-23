"""Persistence helpers used by the scheduler."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable, List

from .models import Appointment


class AppointmentStorage:
    """Store appointments on disk using JSON files."""

    def __init__(self, path: Path) -> None:
        self.path = Path(path)

    def load(self) -> List[Appointment]:
        """Return all stored appointments."""

        if not self.path.exists():
            return []

        with self.path.open("r", encoding="utf-8") as handle:
            raw = json.load(handle)

        return [Appointment.from_dict(item) for item in raw]

    def save(self, appointments: Iterable[Appointment]) -> None:
        """Persist the provided appointments."""

        data = [appointment.to_dict() for appointment in appointments]
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("w", encoding="utf-8") as handle:
            json.dump(data, handle, indent=2, ensure_ascii=False)


__all__ = ["AppointmentStorage"]

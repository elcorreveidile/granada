"""Domain models used by the appointment scheduler."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, Optional
import uuid


@dataclass
class Client:
    """Represents the person attending an appointment."""

    name: str
    email: Optional[str] = None
    phone: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Return a serialisable representation of the client."""

        return {"name": self.name, "email": self.email, "phone": self.phone}

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Client":
        """Create a client from a dictionary."""

        return cls(name=data["name"], email=data.get("email"), phone=data.get("phone"))


@dataclass
class Appointment:
    """Represents a scheduled appointment."""

    client: Client
    service: str
    start_time: datetime
    duration_minutes: int
    status: str = "scheduled"
    notes: Optional[str] = None
    identifier: str = field(default_factory=lambda: uuid.uuid4().hex)

    @property
    def end_time(self) -> datetime:
        """Return the expected finishing time of the appointment."""

        return self.start_time + timedelta(minutes=self.duration_minutes)

    def to_dict(self) -> Dict[str, Any]:
        """Convert the appointment into a serialisable dictionary."""

        return {
            "identifier": self.identifier,
            "client": self.client.to_dict(),
            "service": self.service,
            "start_time": self.start_time.isoformat(),
            "duration_minutes": self.duration_minutes,
            "status": self.status,
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Appointment":
        """Rehydrate an appointment instance from its dictionary representation."""

        return cls(
            identifier=data["identifier"],
            client=Client.from_dict(data["client"]),
            service=data["service"],
            start_time=datetime.fromisoformat(data["start_time"]),
            duration_minutes=int(data["duration_minutes"]),
            status=data.get("status", "scheduled"),
            notes=data.get("notes"),
        )


__all__ = ["Client", "Appointment"]

"""Business logic for the appointment scheduler."""

from __future__ import annotations

from dataclasses import replace
from datetime import datetime
from typing import Iterable, List, Optional

from .models import Appointment, Client
from .storage import AppointmentStorage


class AppointmentNotFoundError(KeyError):
    """Raised when an appointment identifier is unknown."""


class SchedulingConflictError(ValueError):
    """Raised when two appointments overlap in time."""


class Scheduler:
    """Coordinate appointment operations on top of a storage backend."""

    def __init__(self, storage: AppointmentStorage) -> None:
        self._storage = storage

    # ------------------------------------------------------------------
    # Retrieval helpers
    # ------------------------------------------------------------------
    def list_appointments(self) -> List[Appointment]:
        """Return all appointments ordered by start time."""

        return sorted(self._storage.load(), key=lambda appointment: appointment.start_time)

    def get_appointment(self, identifier: str) -> Appointment:
        """Retrieve a single appointment or raise :class:`AppointmentNotFoundError`."""

        for appointment in self._storage.load():
            if appointment.identifier == identifier:
                return appointment
        raise AppointmentNotFoundError(identifier)

    # ------------------------------------------------------------------
    # Creation and mutation
    # ------------------------------------------------------------------
    def create_appointment(
        self,
        *,
        client: Client,
        service: str,
        start_time: datetime,
        duration_minutes: int,
        notes: Optional[str] = None,
    ) -> Appointment:
        """Create and persist a new appointment."""

        appointment = Appointment(
            client=client,
            service=service,
            start_time=start_time,
            duration_minutes=duration_minutes,
            notes=notes,
        )
        appointments = self.list_appointments()
        self._ensure_no_conflict(appointments, appointment)
        appointments.append(appointment)
        self._save(appointments)
        return appointment

    def update_appointment(
        self,
        identifier: str,
        *,
        client: Optional[Client] = None,
        service: Optional[str] = None,
        start_time: Optional[datetime] = None,
        duration_minutes: Optional[int] = None,
        notes: Optional[str] = None,
        status: Optional[str] = None,
    ) -> Appointment:
        """Update an existing appointment."""

        appointments = self.list_appointments()
        for index, appointment in enumerate(appointments):
            if appointment.identifier != identifier:
                continue

            updated = replace(
                appointment,
                client=client or appointment.client,
                service=service or appointment.service,
                start_time=start_time or appointment.start_time,
                duration_minutes=duration_minutes or appointment.duration_minutes,
                notes=notes if notes is not None else appointment.notes,
                status=status or appointment.status,
            )
            self._ensure_no_conflict(appointments, updated, ignore_identifier=identifier)
            appointments[index] = updated
            self._save(appointments)
            return updated

        raise AppointmentNotFoundError(identifier)

    def cancel_appointment(self, identifier: str) -> Appointment:
        """Mark an appointment as cancelled."""

        return self._update_status(identifier, "cancelled")

    def complete_appointment(self, identifier: str) -> Appointment:
        """Mark an appointment as completed."""

        return self._update_status(identifier, "completed")

    # ------------------------------------------------------------------
    # Query helpers
    # ------------------------------------------------------------------
    def upcoming(self, *, after: Optional[datetime] = None) -> List[Appointment]:
        """Return scheduled appointments taking place after ``after``."""

        threshold = after or datetime.utcnow()
        return [appointment for appointment in self.list_appointments() if appointment.start_time >= threshold]

    def find_for_client(self, query: str) -> List[Appointment]:
        """Return appointments whose client matches the query string."""

        lowered = query.lower()
        return [
            appointment
            for appointment in self.list_appointments()
            if lowered in appointment.client.name.lower()
            or (appointment.client.email and lowered in appointment.client.email.lower())
            or (appointment.client.phone and lowered in appointment.client.phone.lower())
        ]

    def find_between(self, start: datetime, end: datetime) -> List[Appointment]:
        """Return appointments starting in the provided time window."""

        if start > end:
            raise ValueError("start must be before end")
        return [
            appointment
            for appointment in self.list_appointments()
            if start <= appointment.start_time < end and appointment.status != "cancelled"
        ]

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _update_status(self, identifier: str, status: str) -> Appointment:
        appointments = self.list_appointments()
        for index, appointment in enumerate(appointments):
            if appointment.identifier != identifier:
                continue
            updated = replace(appointment, status=status)
            appointments[index] = updated
            self._save(appointments)
            return updated
        raise AppointmentNotFoundError(identifier)

    def _ensure_no_conflict(
        self,
        appointments: Iterable[Appointment],
        candidate: Appointment,
        *,
        ignore_identifier: Optional[str] = None,
    ) -> None:
        """Ensure the candidate appointment does not overlap active ones."""

        for existing in appointments:
            if ignore_identifier and existing.identifier == ignore_identifier:
                continue
            if existing.status == "cancelled":
                continue
            if self._overlap(existing, candidate):
                raise SchedulingConflictError(
                    "The appointment overlaps with %s" % existing.identifier
                )

    @staticmethod
    def _overlap(first: Appointment, second: Appointment) -> bool:
        if first.identifier == second.identifier:
            return False
        return first.start_time < second.end_time and second.start_time < first.end_time

    def _save(self, appointments: Iterable[Appointment]) -> None:
        ordered = sorted(appointments, key=lambda item: item.start_time)
        self._storage.save(ordered)


__all__ = [
    "AppointmentNotFoundError",
    "SchedulingConflictError",
    "Scheduler",
]

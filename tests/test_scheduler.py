from datetime import datetime, timedelta
from pathlib import Path

import pytest

from gestor_citas_avanzado.models import Client
from gestor_citas_avanzado.service import (
    AppointmentNotFoundError,
    Scheduler,
    SchedulingConflictError,
)
from gestor_citas_avanzado.storage import AppointmentStorage


@pytest.fixture
def scheduler(tmp_path: Path) -> Scheduler:
    storage = AppointmentStorage(tmp_path / "appointments.json")
    return Scheduler(storage)


def make_client(suffix: str) -> Client:
    return Client(name=f"Client {suffix}", email=f"client{suffix}@example.com")


def test_create_and_list_appointments(scheduler: Scheduler) -> None:
    start = datetime(2024, 1, 15, 9, 0)
    appointment = scheduler.create_appointment(
        client=make_client("A"),
        service="Consultation",
        start_time=start,
        duration_minutes=60,
        notes="Bring documents",
    )

    listed = scheduler.list_appointments()
    assert len(listed) == 1
    stored = listed[0]
    assert stored.identifier == appointment.identifier
    assert stored.client.name == "Client A"
    assert stored.service == "Consultation"
    assert stored.notes == "Bring documents"


def test_prevent_overlapping_appointments(scheduler: Scheduler) -> None:
    start = datetime(2024, 1, 15, 10, 0)
    scheduler.create_appointment(
        client=make_client("A"),
        service="Therapy",
        start_time=start,
        duration_minutes=45,
    )

    with pytest.raises(SchedulingConflictError):
        scheduler.create_appointment(
            client=make_client("B"),
            service="Therapy",
            start_time=start + timedelta(minutes=30),
            duration_minutes=30,
        )


def test_update_appointment_details(scheduler: Scheduler) -> None:
    start = datetime(2024, 1, 15, 11, 0)
    appointment = scheduler.create_appointment(
        client=make_client("A"),
        service="Therapy",
        start_time=start,
        duration_minutes=50,
    )

    updated = scheduler.update_appointment(
        appointment.identifier,
        service="Follow-up",
        start_time=start + timedelta(hours=1),
        duration_minutes=40,
        notes="Update treatment plan",
    )

    assert updated.service == "Follow-up"
    assert updated.duration_minutes == 40
    assert updated.notes == "Update treatment plan"


def test_rescheduling_checks_for_conflicts(scheduler: Scheduler) -> None:
    base = datetime(2024, 1, 16, 9, 0)
    first = scheduler.create_appointment(
        client=make_client("A"),
        service="Consultation",
        start_time=base,
        duration_minutes=60,
    )
    second = scheduler.create_appointment(
        client=make_client("B"),
        service="Coaching",
        start_time=base + timedelta(hours=2),
        duration_minutes=60,
    )

    with pytest.raises(SchedulingConflictError):
        scheduler.update_appointment(
            second.identifier,
            start_time=base + timedelta(minutes=30),
        )

    scheduler.cancel_appointment(first.identifier)
    rescheduled = scheduler.update_appointment(
        second.identifier,
        start_time=base + timedelta(minutes=30),
    )
    assert rescheduled.start_time == base + timedelta(minutes=30)


def test_status_transitions(scheduler: Scheduler) -> None:
    start = datetime(2024, 1, 17, 14, 0)
    appointment = scheduler.create_appointment(
        client=make_client("A"),
        service="Massage",
        start_time=start,
        duration_minutes=60,
    )

    cancelled = scheduler.cancel_appointment(appointment.identifier)
    assert cancelled.status == "cancelled"
    completed = scheduler.complete_appointment(appointment.identifier)
    assert completed.status == "completed"


def test_query_helpers(scheduler: Scheduler) -> None:
    base = datetime(2024, 1, 18, 8, 0)
    scheduler.create_appointment(
        client=make_client("A"),
        service="Therapy",
        start_time=base,
        duration_minutes=30,
    )
    scheduler.create_appointment(
        client=make_client("B"),
        service="Consulting",
        start_time=base + timedelta(hours=5),
        duration_minutes=60,
    )

    window = scheduler.find_between(base, base + timedelta(hours=3))
    assert len(window) == 1
    assert window[0].client.name == "Client A"

    by_client = scheduler.find_for_client("client b")
    assert len(by_client) == 1
    assert by_client[0].client.email == "clientB@example.com"


def test_get_unknown_appointment_raises(scheduler: Scheduler) -> None:
    with pytest.raises(AppointmentNotFoundError):
        scheduler.get_appointment("missing")

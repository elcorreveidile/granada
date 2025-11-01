"""Command line interface for the appointment scheduler."""

from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
from typing import Iterable, Optional

from .models import Client
from .service import (
    AppointmentNotFoundError,
    Scheduler,
    SchedulingConflictError,
)
from .storage import AppointmentStorage


def parse_datetime(value: str) -> datetime:
    """Parse ISO formatted datetimes while providing a helpful error message."""

    try:
        return datetime.fromisoformat(value)
    except ValueError as exc:  # pragma: no cover - defensive
        raise argparse.ArgumentTypeError(str(exc)) from exc


def format_appointments(appointments: Iterable) -> str:
    """Return a multi-line, human readable rendering of appointments."""

    parts = []
    for appointment in appointments:
        parts.append(
            "{id} | {start} ({duration}m) | {client} | {service} | {status}{notes}".format(
                id=appointment.identifier,
                start=appointment.start_time.strftime("%Y-%m-%d %H:%M"),
                duration=appointment.duration_minutes,
                client=appointment.client.name,
                service=appointment.service,
                status=appointment.status,
                notes=f" | {appointment.notes}" if appointment.notes else "",
            )
        )
    return "\n".join(parts)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Manage appointments from the terminal")
    parser.add_argument(
        "--database",
        type=Path,
        default=Path("appointments.json"),
        help="Path to the JSON file where appointments are stored.",
    )

    subparsers = parser.add_subparsers(dest="command", metavar="COMMAND", required=True)

    list_parser = subparsers.add_parser("list", help="List stored appointments")
    list_parser.add_argument("--client", help="Filter by client information")
    list_parser.add_argument("--from", dest="start", type=parse_datetime, help="Start of the time window")
    list_parser.add_argument("--to", dest="end", type=parse_datetime, help="End of the time window")

    add_parser = subparsers.add_parser("add", help="Create a new appointment")
    add_parser.add_argument("--name", required=True, help="Client name")
    add_parser.add_argument("--email", help="Client email")
    add_parser.add_argument("--phone", help="Client phone")
    add_parser.add_argument("--service", required=True, help="Service being booked")
    add_parser.add_argument("--start", required=True, type=parse_datetime, help="Start datetime in ISO format")
    add_parser.add_argument("--duration", required=True, type=int, help="Duration in minutes")
    add_parser.add_argument("--notes", help="Optional notes")

    update_parser = subparsers.add_parser("update", help="Update an existing appointment")
    update_parser.add_argument("identifier", help="Identifier of the appointment to update")
    update_parser.add_argument("--name", help="Client name")
    update_parser.add_argument("--email", help="Client email")
    update_parser.add_argument("--phone", help="Client phone")
    update_parser.add_argument("--service", help="Service name")
    update_parser.add_argument("--start", type=parse_datetime, help="New start datetime")
    update_parser.add_argument("--duration", type=int, help="New duration in minutes")
    update_parser.add_argument("--status", help="New appointment status")
    update_parser.add_argument("--notes", help="New notes")

    cancel_parser = subparsers.add_parser("cancel", help="Cancel an appointment")
    cancel_parser.add_argument("identifier", help="Identifier to cancel")

    complete_parser = subparsers.add_parser("complete", help="Mark an appointment as completed")
    complete_parser.add_argument("identifier", help="Identifier to complete")

    return parser


def run_from_args(args: argparse.Namespace) -> str:
    storage = AppointmentStorage(args.database)
    scheduler = Scheduler(storage)

    if args.command == "list":
        appointments = scheduler.list_appointments()
        if args.client:
            appointments = [a for a in appointments if args.client.lower() in format_client(a.client).lower()]
        if args.start or args.end:
            start = args.start or datetime.min
            end = args.end or datetime.max
            appointments = [a for a in appointments if start <= a.start_time < end]
        return format_appointments(appointments)

    if args.command == "add":
        client = Client(name=args.name, email=args.email, phone=args.phone)
        appointment = scheduler.create_appointment(
            client=client,
            service=args.service,
            start_time=args.start,
            duration_minutes=args.duration,
            notes=args.notes,
        )
        return f"Created appointment {appointment.identifier}"

    if args.command == "update":
        existing = scheduler.get_appointment(args.identifier)
        client = existing.client
        if args.name or args.email or args.phone:
            client = Client(
                name=args.name or existing.client.name,
                email=args.email if args.email is not None else existing.client.email,
                phone=args.phone if args.phone is not None else existing.client.phone,
            )
        appointment = scheduler.update_appointment(
            args.identifier,
            client=client if (args.name or args.email or args.phone) else None,
            service=args.service,
            start_time=args.start,
            duration_minutes=args.duration,
            status=args.status,
            notes=args.notes,
        )
        return f"Updated appointment {appointment.identifier}"

    if args.command == "cancel":
        appointment = scheduler.cancel_appointment(args.identifier)
        return f"Cancelled appointment {appointment.identifier}"

    if args.command == "complete":
        appointment = scheduler.complete_appointment(args.identifier)
        return f"Completed appointment {appointment.identifier}"

    raise SystemExit("No command supplied")


def format_client(client: Client) -> str:
    parts = [client.name]
    if client.email:
        parts.append(client.email)
    if client.phone:
        parts.append(client.phone)
    return " | ".join(parts)


def main(argv: Optional[Iterable[str]] = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        result = run_from_args(args)
    except SchedulingConflictError as exc:
        parser.exit(1, f"Error: {exc}\n")
    except AppointmentNotFoundError as exc:
        parser.exit(1, f"Error: appointment {exc.args[0]} not found\n")
    if result:
        print(result)


__all__ = ["main", "build_parser", "run_from_args"]

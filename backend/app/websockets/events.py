from datetime import datetime
from typing import Any

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.models import Queue, Ticket
from app.services.queue_service import queue_snapshot
from app.websockets.manager import manager

# Noms des événements : une seule source de vérité, réutilisée partout
SNAPSHOT = "snapshot"
TICKET_CREATED = "ticket_created"
TICKET_CALLED = "ticket_called"
TICKET_UPDATED = "ticket_updated"
QUEUE_UPDATED = "queue_updated"


def build_message(
    event: str,
    snapshot: dict[str, Any],
    ticket: Ticket | None = None,
) -> dict[str, Any]:
    return {
        "event": event,
        "queue": snapshot,
        "ticket": (
            {
                "id": ticket.id,
                "code": ticket.code,
                "number": ticket.number,
                "status": ticket.status.value,
            }
            if ticket is not None
            else None
        ),
        "sent_at": datetime.now().isoformat(timespec="seconds"),
    }


def publish(
    background_tasks: BackgroundTasks,
    db: Session,
    event: str,
    queue: Queue,
    ticket: Ticket | None = None,
) -> None:
    """Prépare le message MAINTENANT (session ouverte) et programme sa
    diffusion juste après l'envoi de la réponse HTTP."""
    message = build_message(event, queue_snapshot(db, queue), ticket)
    background_tasks.add_task(manager.broadcast, queue.id, message)
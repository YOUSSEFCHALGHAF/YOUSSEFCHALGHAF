from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Establishment, Queue, Role, Ticket, TicketStatus, User
from app.schemas.queue import QueueRead

RECENT_TICKETS_FOR_AVERAGE = 10


def get_queue_or_404(db: Session, queue_id: int) -> Queue:
    queue = db.get(Queue, queue_id)
    if queue is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File introuvable")
    return queue


def lock_queue(db: Session, queue_id: int) -> Queue:
    """Lit la file en posant un verrou exclusif sur sa ligne.

    Toute autre transaction qui demande le même verrou ATTEND jusqu'au
    COMMIT ou ROLLBACK de la nôtre : les opérations sur une file sont
    donc exécutées l'une après l'autre.
    """
    stmt = (
        select(Queue)
        .where(Queue.id == queue_id)
        .with_for_update()                              # SELECT ... FOR UPDATE
        .execution_options(populate_existing=True)      # recharge les valeurs fraîches
    )
    queue = db.execute(stmt).scalar_one_or_none()
    if queue is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File introuvable")
    return queue


def can_manage_establishment(establishment: Establishment, user: User) -> bool:
    if user.role == Role.ADMIN:
        return True
    return user.role == Role.MERCHANT and establishment.owner_id == user.id


def ensure_can_manage_establishment(establishment: Establishment, user: User) -> None:
    if not can_manage_establishment(establishment, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Vous ne gérez pas cet établissement")


def ensure_can_manage_queue(queue: Queue, user: User) -> None:
    ensure_can_manage_establishment(queue.establishment, user)


def count_waiting(db: Session, queue: Queue) -> int:
    stmt = select(func.count(Ticket.id)).where(
        Ticket.queue_id == queue.id,
        Ticket.service_date == date.today(),
        Ticket.status == TicketStatus.WAITING,
    )
    return db.scalar(stmt) or 0


def average_service_minutes(db: Session, queue: Queue) -> float:
    stmt = (
        select(Ticket.called_at, Ticket.finished_at)
        .where(
            Ticket.queue_id == queue.id,
            Ticket.status == TicketStatus.SERVED,
            Ticket.called_at.is_not(None),
            Ticket.finished_at.is_not(None),
        )
        .order_by(Ticket.finished_at.desc())
        .limit(RECENT_TICKETS_FOR_AVERAGE)
    )
    durations = [
        (finished - called).total_seconds() / 60 for called, finished in db.execute(stmt)
    ]
    if not durations:
        return float(queue.avg_service_minutes)
    return max(1.0, sum(durations) / len(durations))  # au moins 1 minute


def queue_to_read(db: Session, queue: Queue) -> QueueRead:
    waiting = count_waiting(db, queue)
    average = average_service_minutes(db, queue)
    return QueueRead.model_validate(queue).model_copy(
        update={
            "waiting_count": waiting,
            # un nouveau venu serait en position waiting + 1
            "estimated_wait_minutes": round((waiting + 1) * average),
        }
    )
def queue_snapshot(db: Session, queue: Queue) -> dict:
    """État public de la file, diffusé par WebSocket (aucune donnée personnelle)."""
    rows = db.execute(
        select(Ticket.number, Ticket.code, Ticket.status)
        .where(
            Ticket.queue_id == queue.id,
            Ticket.service_date == date.today(),
            Ticket.status.in_((TicketStatus.WAITING, TicketStatus.CALLED)),
        )
        .order_by(Ticket.number)
    ).all()

    waiting_numbers = [number for number, _code, st in rows if st == TicketStatus.WAITING]
    called_codes = [code for _number, code, st in rows if st == TicketStatus.CALLED]

    return {
        "queue_id": queue.id,
        "name": queue.name,
        "is_open": queue.is_open,
        "remote_booking_enabled": queue.remote_booking_enabled,
        "waiting_count": len(waiting_numbers),
        "waiting_numbers": waiting_numbers,
        "current_code": called_codes[-1] if called_codes else None,
        "avg_service_minutes": round(average_service_minutes(db, queue), 1),
    }
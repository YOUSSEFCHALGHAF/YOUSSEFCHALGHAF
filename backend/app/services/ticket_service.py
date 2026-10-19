from collections import Counter
from datetime import date, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Queue, Ticket, TicketStatus, User
from app.schemas.queue import QueueStats
from app.schemas.ticket import TicketRead
from app.services.audit_service import log_action
from app.services.queue_service import (
    average_service_minutes,
    can_manage_establishment,
    ensure_can_manage_queue,
    lock_queue,
)

ACTIVE_STATUSES = (TicketStatus.WAITING, TicketStatus.CALLED)

# Changements de statut autorisés pour le commerçant (RG-05)
ALLOWED_TRANSITIONS = {
    TicketStatus.WAITING: {TicketStatus.CANCELLED, TicketStatus.NO_SHOW},
    TicketStatus.CALLED: {TicketStatus.SERVED, TicketStatus.NO_SHOW, TicketStatus.CANCELLED},
}


# ---------- Lecture ----------

def get_ticket_or_404(db: Session, ticket_id: int) -> Ticket:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ticket introuvable")
    return ticket


def _lock_ticket(db: Session, ticket_id: int) -> Ticket:
    stmt = (
        select(Ticket)
        .where(Ticket.id == ticket_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    ticket = db.execute(stmt).scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ticket introuvable")
    return ticket


def ensure_can_view(ticket: Ticket, user: User) -> None:
    """Le titulaire du ticket, le commerçant de la file ou un admin."""
    if ticket.user_id == user.id or can_manage_establishment(ticket.queue.establishment, user):
        return
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès refusé à ce ticket")


def compute_position(db: Session, ticket: Ticket) -> int | None:
    if ticket.status == TicketStatus.CALLED:
        return 0
    if ticket.status != TicketStatus.WAITING:
        return None  # ticket terminé : plus de position
    ahead = db.scalar(
        select(func.count(Ticket.id)).where(
            Ticket.queue_id == ticket.queue_id,
            Ticket.service_date == ticket.service_date,
            Ticket.status == TicketStatus.WAITING,
            Ticket.number < ticket.number,
        )
    ) or 0
    return ahead + 1


def ticket_to_read(db: Session, ticket: Ticket) -> TicketRead:
    position = compute_position(db, ticket)
    if position is None:
        estimated = None
    elif position == 0:
        estimated = 0
    else:
        estimated = round(position * average_service_minutes(db, ticket.queue))

    queue = ticket.queue
    return TicketRead(
        id=ticket.id,
        code=ticket.code,
        number=ticket.number,
        status=ticket.status,
        queue_id=queue.id,
        queue_name=queue.name,
        establishment_id=queue.establishment_id,
        establishment_name=queue.establishment.name,
        service_date=ticket.service_date,
        position=position,
        estimated_wait_minutes=estimated,
        created_at=ticket.created_at,
        called_at=ticket.called_at,
        finished_at=ticket.finished_at,
    )


def list_user_tickets(db: Session, user: User, limit: int = 50) -> list[Ticket]:
    stmt = (
        select(Ticket)
        .where(Ticket.user_id == user.id)
        .order_by(Ticket.created_at.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt))


def list_active_tickets(db: Session, queue: Queue) -> list[Ticket]:
    stmt = (
        select(Ticket)
        .where(
            Ticket.queue_id == queue.id,
            Ticket.service_date == date.today(),
            Ticket.status.in_(ACTIVE_STATUSES),
        )
        .order_by(Ticket.number)
    )
    return list(db.scalars(stmt))


# ---------- Écriture ----------

def take_ticket(db: Session, queue_id: int, user: User) -> Ticket:
    """Attribue le numéro suivant de manière sûre, même en cas de demandes simultanées."""
    try:
        queue = lock_queue(db, queue_id)  # 1. verrou : les autres demandes attendent ici

        # 2. Règles d'accès à la file (RG-04)
        if not queue.establishment.is_active:
            raise HTTPException(status.HTTP_409_CONFLICT, "Établissement indisponible")
        if not queue.is_open:
            raise HTTPException(status.HTTP_409_CONFLICT, "La file est fermée")
        if not queue.remote_booking_enabled:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "La prise de ticket à distance est désactivée"
            )

        today = date.today()
        # 3. Un seul ticket actif par client et par file (RG-01)
        already = db.scalar(
            select(Ticket.id).where(
                Ticket.queue_id == queue.id,
                Ticket.user_id == user.id,
                Ticket.service_date == today,
                Ticket.status.in_(ACTIVE_STATUSES),
            )
        )
        if already is not None:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Vous avez déjà un ticket actif dans cette file"
            )

        # 4. Nouveau jour : le compteur repart de zéro (RG-02)
        if queue.service_date != today:
            queue.service_date = today
            queue.last_number = 0

        # 5. Numéro suivant, calculé sous verrou
        queue.last_number += 1
        ticket = Ticket(
            queue_id=queue.id,
            user_id=user.id,
            number=queue.last_number,
            code=f"{queue.prefix}-{queue.last_number:03d}",  # ex. A-007
            status=TicketStatus.WAITING,
            service_date=today,
        )
        db.add(ticket)
        db.flush()  # obtient ticket.id
        log_action(db, user, "TICKET_CREATED", "ticket", ticket.id, {"code": ticket.code})

        db.commit()  # 6. valide tout et libère le verrou
    except HTTPException:
        db.rollback()  # libère aussi le verrou en cas de refus
        raise
    except IntegrityError:
        # Filet de sécurité : la contrainte UNIQUE a bloqué un doublon
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Conflit d'attribution, réessayez")

    db.refresh(ticket)
    return ticket


def call_next(db: Session, queue_id: int, user: User) -> Ticket:
    try:
        queue = lock_queue(db, queue_id)
        ensure_can_manage_queue(queue, user)
        today = date.today()
        now = datetime.now()

        # RG-07 : le ticket appelé précédemment est considéré comme servi
        previous = db.scalars(
            select(Ticket)
            .where(
                Ticket.queue_id == queue.id,
                Ticket.service_date == today,
                Ticket.status == TicketStatus.CALLED,
            )
            .with_for_update()
            .execution_options(populate_existing=True)
        ).all()
        for old in previous:
            old.status = TicketStatus.SERVED
            old.finished_at = now

        # Plus petit numéro encore en attente
        ticket = db.scalars(
            select(Ticket)
            .where(
                Ticket.queue_id == queue.id,
                Ticket.service_date == today,
                Ticket.status == TicketStatus.WAITING,
            )
            .order_by(Ticket.number)
            .limit(1)
            .with_for_update()
            .execution_options(populate_existing=True)
        ).first()

        if ticket is None:
            db.commit()  # on garde la clôture du ticket précédent
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Aucun client en attente")

        ticket.status = TicketStatus.CALLED
        ticket.called_at = now
        log_action(db, user, "TICKET_CALLED", "ticket", ticket.id, {"code": ticket.code})
        db.commit()
    except HTTPException:
        db.rollback()
        raise

    db.refresh(ticket)
    return ticket


def change_status(db: Session, ticket_id: int, new_status: TicketStatus, user: User) -> Ticket:
    """Commerçant : marquer un ticket servi, absent ou annulé."""
    try:
        ticket = _lock_ticket(db, ticket_id)
        ensure_can_manage_queue(ticket.queue, user)

        allowed = ALLOWED_TRANSITIONS.get(ticket.status, set())
        if new_status not in allowed:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Changement impossible : {ticket.status.value} → {new_status.value}",
            )

        old_status = ticket.status
        ticket.status = new_status
        ticket.finished_at = datetime.now()
        log_action(
            db, user, "TICKET_STATUS_CHANGED", "ticket", ticket.id,
            {"from": old_status.value, "to": new_status.value},
        )
        db.commit()
    except HTTPException:
        db.rollback()
        raise

    db.refresh(ticket)
    return ticket


def cancel_by_client(db: Session, ticket_id: int, user: User) -> Ticket:
    """Client : annuler son propre ticket tant qu'il est en attente (RG-03)."""
    try:
        ticket = _lock_ticket(db, ticket_id)
        if ticket.user_id != user.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Ce ticket ne vous appartient pas")
        if ticket.status != TicketStatus.WAITING:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Seul un ticket en attente peut être annulé"
            )
        ticket.status = TicketStatus.CANCELLED
        ticket.finished_at = datetime.now()
        log_action(db, user, "TICKET_CANCELLED", "ticket", ticket.id, {"code": ticket.code})
        db.commit()
    except HTTPException:
        db.rollback()
        raise

    db.refresh(ticket)
    return ticket


# ---------- Statistiques du jour (BF-14) ----------

def queue_stats(db: Session, queue: Queue) -> QueueStats:
    today = date.today()
    tickets = list(
        db.scalars(
            select(Ticket).where(Ticket.queue_id == queue.id, Ticket.service_date == today)
        )
    )
    counts = Counter(t.status for t in tickets)
    waits = [
        (t.called_at - t.created_at).total_seconds() / 60 for t in tickets if t.called_at
    ]
    return QueueStats(
        day=today,
        total=len(tickets),
        waiting=counts[TicketStatus.WAITING],
        called=counts[TicketStatus.CALLED],
        served=counts[TicketStatus.SERVED],
        no_show=counts[TicketStatus.NO_SHOW],
        cancelled=counts[TicketStatus.CANCELLED],
        avg_wait_minutes=round(sum(waits) / len(waits), 1) if waits else None,
        avg_service_minutes=round(average_service_minutes(db, queue), 1),
    )
from fastapi import APIRouter, BackgroundTasks, Depends, status

from app.websockets.events import QUEUE_UPDATED, TICKET_CALLED, TICKET_CREATED, publish
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models import Role, User
from app.schemas.queue import QueueRead, QueueStats, QueueUpdate
from app.schemas.ticket import TicketRead
from app.services import ticket_service
from app.services.audit_service import log_action
from app.services.queue_service import ensure_can_manage_queue, get_queue_or_404, queue_to_read
from app.services import notification_service
router = APIRouter(prefix="/api/queues", tags=["Files d'attente"])
manager = require_roles(Role.MERCHANT, Role.ADMIN)


@router.get("/{queue_id}", response_model=QueueRead)
def get_queue(queue_id: int, db: Session = Depends(get_db)):
    return queue_to_read(db, get_queue_or_404(db, queue_id))


@router.patch("/{queue_id}", response_model=QueueRead)
def update_queue(
    queue_id: int,
    payload: QueueUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(manager),
):
    """Configurer, ouvrir/fermer, activer/désactiver la prise à distance (BF-13)."""
    queue = get_queue_or_404(db, queue_id)
    ensure_can_manage_queue(queue, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(queue, field, value)
    log_action(db, user, "QUEUE_UPDATED", "queue", queue.id, payload.model_dump(exclude_unset=True))
    db.commit()
    db.refresh(queue)
    publish(background_tasks, db, QUEUE_UPDATED, queue)
    return queue_to_read(db, queue)


@router.post("/{queue_id}/tickets", response_model=TicketRead, status_code=status.HTTP_201_CREATED)
def take_ticket(
    queue_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.CLIENT)),
):
    """Client : prendre un ticket virtuel (BF-04)."""
    ticket = ticket_service.take_ticket(db, queue_id, user)
    publish(background_tasks, db, TICKET_CREATED, ticket.queue, ticket)
    # dans take_ticket, après publish(...)
    background_tasks.add_task(notification_service.notify_ticket_created, ticket.id)
    return ticket_service.ticket_to_read(db, ticket)



@router.get("/{queue_id}/tickets", response_model=list[TicketRead])
def list_queue_tickets(queue_id: int, db: Session = Depends(get_db), user: User = Depends(manager)):
    """Commerçant : tickets en attente et appelés aujourd'hui (BF-10)."""
    queue = get_queue_or_404(db, queue_id)
    ensure_can_manage_queue(queue, user)
    return [ticket_service.ticket_to_read(db, t) for t in ticket_service.list_active_tickets(db, queue)]


@router.post("/{queue_id}/call-next", response_model=TicketRead)
def call_next(
    queue_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(manager),
):
    """Commerçant : appeler le client suivant (BF-11)."""
    ticket = ticket_service.call_next(db, queue_id, user)
    publish(background_tasks, db, TICKET_CALLED, ticket.queue, ticket)
    # dans call_next, après publish(...)
    background_tasks.add_task(notification_service.notify_ticket_called, ticket.id)
    background_tasks.add_task(notification_service.notify_turn_approaching, ticket.queue_id)
    return ticket_service.ticket_to_read(db, ticket)


@router.get("/{queue_id}/stats", response_model=QueueStats)
def queue_stats(queue_id: int, db: Session = Depends(get_db), user: User = Depends(manager)):
    """Commerçant : statistiques du jour (BF-14)."""
    queue = get_queue_or_404(db, queue_id)
    ensure_can_manage_queue(queue, user)
    return ticket_service.queue_stats(db, queue)
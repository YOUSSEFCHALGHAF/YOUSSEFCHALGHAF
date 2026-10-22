from fastapi import APIRouter, BackgroundTasks, Depends

from app.websockets.events import TICKET_UPDATED, publish
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models import Role, User
from app.schemas.ticket import TicketRead, TicketStatusUpdate
from app.services import ticket_service
from app.services import notification_service

router = APIRouter(prefix="/api/tickets", tags=["Tickets"])


@router.get("/me", response_model=list[TicketRead])
def my_tickets(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Historique des tickets de l'utilisateur connecté (BF-08)."""
    return [ticket_service.ticket_to_read(db, t) for t in ticket_service.list_user_tickets(db, user)]


@router.get("/{ticket_id}", response_model=TicketRead)
def get_ticket(ticket_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Suivi d'un ticket : position et temps estimé (BF-05)."""
    ticket = ticket_service.get_ticket_or_404(db, ticket_id)
    ticket_service.ensure_can_view(ticket, user)
    return ticket_service.ticket_to_read(db, ticket)


@router.post("/{ticket_id}/cancel", response_model=TicketRead)
def cancel_ticket(
    ticket_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.CLIENT)),
):
    """Client : annuler son ticket (BF-07)."""
    ticket = ticket_service.cancel_by_client(db, ticket_id, user)
    publish(background_tasks, db, TICKET_UPDATED, ticket.queue, ticket)
    background_tasks.add_task(notification_service.notify_turn_approaching, ticket.queue_id)
    return ticket_service.ticket_to_read(db, ticket)


@router.patch("/{ticket_id}/status", response_model=TicketRead)
def change_ticket_status(
    ticket_id: int,
    payload: TicketStatusUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.MERCHANT, Role.ADMIN)),
):
    """Commerçant : servi, absent ou annulé (BF-12)."""
    ticket = ticket_service.change_status(db, ticket_id, payload.status, user)
    publish(background_tasks, db, TICKET_UPDATED, ticket.queue, ticket)
    background_tasks.add_task(notification_service.notify_turn_approaching, ticket.queue_id)
    return ticket_service.ticket_to_read(db, ticket)
import enum
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Date, DateTime, Enum as SAEnum, ForeignKey, Index, Integer, String, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.queue import Queue
    from app.models.user import User


class TicketStatus(str, enum.Enum):
    WAITING = "WAITING"      # en attente
    CALLED = "CALLED"        # appelé au guichet
    SERVED = "SERVED"        # servi
    NO_SHOW = "NO_SHOW"      # absent
    CANCELLED = "CANCELLED"  # annulé


class Ticket(Base):
    __tablename__ = "tickets"
    __table_args__ = (
        # Filet de sécurité : un même numéro ne peut exister qu'une fois par file et par jour
        UniqueConstraint("queue_id", "service_date", "number", name="uq_ticket_queue_day_number"),
        # Accélère les calculs de position (tickets WAITING d'une file, aujourd'hui)
        Index("ix_tickets_queue_day_status", "queue_id", "service_date", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    queue_id: Mapped[int] = mapped_column(ForeignKey("queues.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    number: Mapped[int] = mapped_column(Integer)
    code: Mapped[str] = mapped_column(String(12))  # ex. "A-007"
    status: Mapped[TicketStatus] = mapped_column(
        SAEnum(TicketStatus, name="ticket_status"), default=TicketStatus.WAITING
    )
    service_date: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    called_at: Mapped[datetime | None] = mapped_column(DateTime)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime)

    queue: Mapped["Queue"] = relationship(back_populates="tickets")
    user: Mapped["User"] = relationship(back_populates="tickets")
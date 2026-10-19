from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.establishment import Establishment
    from app.models.ticket import Ticket


class Queue(Base):
    __tablename__ = "queues"

    id: Mapped[int] = mapped_column(primary_key=True)
    establishment_id: Mapped[int] = mapped_column(
        ForeignKey("establishments.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    prefix: Mapped[str] = mapped_column(String(5), default="A")
    is_open: Mapped[bool] = mapped_column(Boolean, default=True)
    remote_booking_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    avg_service_minutes: Mapped[int] = mapped_column(Integer, default=5)
    notify_before: Mapped[int] = mapped_column(Integer, default=2)
    # Compteur du jour : dernier numéro attribué (protégé par verrou, voir section 6)
    last_number: Mapped[int] = mapped_column(Integer, default=0)
    service_date: Mapped[date] = mapped_column(Date, default=date.today)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    establishment: Mapped["Establishment"] = relationship(back_populates="queues")
    tickets: Mapped[list["Ticket"]] = relationship(
        back_populates="queue", cascade="all, delete-orphan"
    )
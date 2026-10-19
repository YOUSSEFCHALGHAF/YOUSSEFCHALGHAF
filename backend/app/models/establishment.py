import enum
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.queue import Queue
    from app.models.user import User


class EstablishmentCategory(str, enum.Enum):
    COMMERCE = "COMMERCE"
    SANTE = "SANTE"
    BEAUTE = "BEAUTE"
    SERVICE_PUBLIC = "SERVICE_PUBLIC"


class Establishment(Base):
    __tablename__ = "establishments"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), index=True)
    category: Mapped[EstablishmentCategory] = mapped_column(
        SAEnum(EstablishmentCategory, name="establishment_category"), index=True
    )
    address: Mapped[str] = mapped_column(String(255))
    city: Mapped[str] = mapped_column(String(100), index=True)
    phone: Mapped[str | None] = mapped_column(String(30))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Commerçant responsable ; NULL tant que l'admin n'en a pas attribué
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    owner: Mapped[Optional["User"]] = relationship(back_populates="establishments")
    queues: Mapped[list["Queue"]] = relationship(
        back_populates="establishment", cascade="all, delete-orphan", order_by="Queue.id"
    )
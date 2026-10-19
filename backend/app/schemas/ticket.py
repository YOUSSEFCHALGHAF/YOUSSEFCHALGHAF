from datetime import date, datetime

from pydantic import BaseModel

from app.models import TicketStatus


class TicketRead(BaseModel):
    id: int
    code: str
    number: int
    status: TicketStatus
    queue_id: int
    queue_name: str
    establishment_id: int
    establishment_name: str
    service_date: date
    position: int | None                # 1 = prochain ; 0 = appelé ; None = terminé
    estimated_wait_minutes: int | None
    created_at: datetime
    called_at: datetime | None
    finished_at: datetime | None


class TicketStatusUpdate(BaseModel):
    status: TicketStatus
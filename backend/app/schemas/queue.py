from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class QueueCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    prefix: str = Field(default="A", pattern=r"^[A-Z]{1,3}$")  # 1 à 3 majuscules
    avg_service_minutes: int = Field(default=5, ge=1, le=240)
    notify_before: int = Field(default=2, ge=1, le=10)
    is_open: bool = True
    remote_booking_enabled: bool = True


class QueueUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    prefix: str | None = Field(default=None, pattern=r"^[A-Z]{1,3}$")
    avg_service_minutes: int | None = Field(default=None, ge=1, le=240)
    notify_before: int | None = Field(default=None, ge=1, le=10)
    is_open: bool | None = None
    remote_booking_enabled: bool | None = None


class QueueRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    establishment_id: int
    name: str
    prefix: str
    is_open: bool
    remote_booking_enabled: bool
    avg_service_minutes: int
    notify_before: int
    waiting_count: int = 0           # calculé, pas une colonne
    estimated_wait_minutes: int = 0  # attente estimée pour un nouveau ticket


class QueueStats(BaseModel):
    day: date  # « day » et non « date » : un champ ne doit pas porter le nom de son type
    total: int
    waiting: int
    called: int
    served: int
    no_show: int
    cancelled: int
    avg_wait_minutes: float | None     # entre la prise du ticket et l'appel
    avg_service_minutes: float         # entre l'appel et la fin
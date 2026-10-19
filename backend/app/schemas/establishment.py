from pydantic import BaseModel, ConfigDict, Field

from app.models import EstablishmentCategory


class EstablishmentBase(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    category: EstablishmentCategory
    address: str = Field(min_length=3, max_length=255)
    city: str = Field(min_length=2, max_length=100)
    phone: str | None = Field(default=None, max_length=30)


class EstablishmentCreate(EstablishmentBase):
    owner_id: int | None = None  # commerçant responsable (facultatif)


class EstablishmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    category: EstablishmentCategory | None = None
    address: str | None = Field(default=None, min_length=3, max_length=255)
    city: str | None = Field(default=None, min_length=2, max_length=100)
    phone: str | None = Field(default=None, max_length=30)
    owner_id: int | None = None
    is_active: bool | None = None


class EstablishmentRead(EstablishmentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    owner_id: int | None
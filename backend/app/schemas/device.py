from pydantic import BaseModel, Field


class DeviceTokenCreate(BaseModel):
    token: str = Field(min_length=20, max_length=512)
    user_agent: str | None = Field(default=None, max_length=255)


class DeviceTokenDelete(BaseModel):
    token: str = Field(min_length=1, max_length=512)
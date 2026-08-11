from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RequestCreate(BaseModel):
    request_type: str = Field(
        min_length=1,
        max_length=100,
    )
    title: str = Field(
        min_length=1,
        max_length=200,
    )
    description: str = Field(
        min_length=1,
        max_length=2000,
    )

class RequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    request_type: str
    title: str
    description: str
    applicant_name: str
    status: str
    created_at: datetime
    updated_at: datetime


class ApprovalAction(BaseModel):
    comment: str | None = Field(
        default=None,
        max_length=1000,
    )


class ApprovalHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    request_id: int
    action: str
    comment: str | None
    approver_name: str
    created_at: datetime

class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=200)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    role: str
    is_active: bool

class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=8, max_length=200)
    role: str = Field(default="user", pattern="^(user|approver|admin)$")


class UserRoleUpdate(BaseModel):
    role: str = Field(pattern="^(user|approver|admin)$")

class UserActiveUpdate(BaseModel):
    is_active: bool

class RequestTypeCreate(BaseModel):
    code: str = Field(
        min_length=1,
        max_length=50,
        pattern="^[a-z0-9_]+$",
    )
    name: str = Field(min_length=1, max_length=100)


class RequestTypeUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    is_active: bool


class RequestTypeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str
    is_active: bool




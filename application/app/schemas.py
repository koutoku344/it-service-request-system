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
    applicant_name: str = Field(
        min_length=1,
        max_length=100,
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
    approver_name: str = Field(
        min_length=1,
        max_length=100,
    )

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

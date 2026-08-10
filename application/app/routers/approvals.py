from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db


router = APIRouter(
    prefix="/requests",
    tags=["approvals"],
)


def get_pending_request_or_404(
    request_id: int,
    db: Session,
):
    db_request = crud.get_request(db, request_id)

    if db_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        )

    if db_request.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending requests can be approved or rejected",
        )

    return db_request


@router.patch(
    "/{request_id}/approve",
    response_model=schemas.RequestResponse,
)
def approve_request(
    request_id: int,
    action_data: schemas.ApprovalAction,
    db: Session = Depends(get_db),
):
    db_request = get_pending_request_or_404(request_id, db)

    return crud.update_request_status(
        db=db,
        db_request=db_request,
        new_status="approved",
        approver_name=action_data.approver_name,
        comment=action_data.comment,
    )


@router.patch(
    "/{request_id}/reject",
    response_model=schemas.RequestResponse,
)
def reject_request(
    request_id: int,
    action_data: schemas.ApprovalAction,
    db: Session = Depends(get_db),
):
    db_request = get_pending_request_or_404(request_id, db)

    return crud.update_request_status(
        db=db,
        db_request=db_request,
        new_status="rejected",
        approver_name=action_data.approver_name,
        comment=action_data.comment,
    )


@router.get(
    "/{request_id}/approval-history",
    response_model=list[schemas.ApprovalHistoryResponse],
)
def list_approval_history(
    request_id: int,
    db: Session = Depends(get_db),
):
    db_request = crud.get_request(db, request_id)

    if db_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        )

    return crud.get_approval_histories(db, request_id)

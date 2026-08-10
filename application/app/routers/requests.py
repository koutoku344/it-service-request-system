from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db


router = APIRouter(
    prefix="/requests",
    tags=["requests"],
)


@router.post(
    "",
    response_model=schemas.RequestResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_request(
    request_data: schemas.RequestCreate,
    db: Session = Depends(get_db),
):
    return crud.create_request(
        db,
        request_data,
    )


@router.get(
    "",
    response_model=list[schemas.RequestResponse],
)
def list_requests(
    db: Session = Depends(get_db),
):
    return crud.get_requests(db)


@router.get(
    "/{request_id}",
    response_model=schemas.RequestResponse,
)
def get_request(
    request_id: int,
    db: Session = Depends(get_db),
):
    db_request = crud.get_request(
        db,
        request_id,
    )

    if db_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        )

    return db_request


@router.patch(
    "/{request_id}/cancel",
    response_model=schemas.RequestResponse,
)
def cancel_request(
    request_id: int,
    db: Session = Depends(get_db),
):
    db_request = crud.get_request(
        db,
        request_id,
    )

    if db_request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        )

    if db_request.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending requests can be cancelled",
        )

    return crud.cancel_request(
        db,
        db_request,
    )

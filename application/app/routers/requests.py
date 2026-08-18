from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db
from app import models
from app.auth import get_current_user

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
    current_user: models.User = Depends(get_current_user),
):
    request_type_master = crud.get_request_type_by_code(
        db,
        request_data.request_type,
    )

    if request_type_master is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid request type",
        )

    if not request_type_master.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request type is inactive",
        )

    return crud.create_request(
        db,
        request_data,
        current_user.username,
    )


@router.get( 
    ““, 
    response_model=list[schemas.RequestResponse], 
) 
def list_requests( 
    db: Session = Depends(get_db), 
    current_user: models.User= Depends(get_current_user), 
): 
    return crud.get_requests(db)


@router.get(
    "/{request_id}",
    response_model=schemas.RequestResponse,
)
def get_request( 
    request_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user), 
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
    current_user: models.User = Depends(
        get_current_user
        )
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

    if (
        db_request.applicant_name != current_user.username
        and current_user.role != "admin"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot cancel another user's request",
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

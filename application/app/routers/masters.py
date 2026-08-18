from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.auth import get_current_user, require_roles
from app.database import get_db


router = APIRouter(prefix="/admin/masters", tags=["master-management"])

request_types_router = APIRouter( 
    prefix="/request-types",
    tags=["request-types"], 
    )

@request_types_router.get(
    "",
    response_model=list[schemas.RequestTypeResponse],
)
def list_available_request_types(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return [
        request_type
        for request_type in crud.get_request_types(db)
        if request_type.is_active
    ]

@router.get(
    "/request-types",
    response_model=list[schemas.RequestTypeResponse],
)
def list_request_types(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin")),
):
    return crud.get_request_types(db)


@router.post(
    "/request-types",
    response_model=schemas.RequestTypeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_request_type(
    data: schemas.RequestTypeCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin")),
):
    if crud.get_request_type_by_code(db, data.code) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Request type code already exists",
        )
    return crud.create_request_type(db, data)


@router.patch(
    "/request-types/{code}",
    response_model=schemas.RequestTypeResponse,
)
def update_request_type(
    code: str,
    data: schemas.RequestTypeUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin")),
):
    master = crud.get_request_type_by_code(db, code)
    if master is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request type not found",
        )
    return crud.update_request_type(db, master, data)

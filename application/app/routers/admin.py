from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.auth import require_roles
from app.database import get_db


router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[schemas.UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin")),
):
    return crud.get_users(db)

@router.get("/users/{user_id}", response_model=schemas.UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin")),
):
    user = crud.get_user(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


@router.post(
    "/users",
    response_model=schemas.UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_user(
    user_data: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin")),
):
    if crud.get_user_by_username(db, user_data.username) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists",
        )
    return crud.create_user(db, user_data)


@router.patch("/users/{user_id}/role", response_model=schemas.UserResponse)
def change_user_role(
    user_id: int,
    role_data: schemas.UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin")),
):
    user = crud.get_user(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return crud.update_user_role(db, user, role_data.role)


@router.patch("/users/{user_id}/active", response_model=schemas.UserResponse)
def change_user_active(
    user_id: int,
    active_data: schemas.UserActiveUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin")),
):
    user = crud.get_user(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    if user.id == current_user.id and not active_data.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You cannot deactivate yourself",
        )
    return crud.update_user_active(db, user, active_data.is_active)




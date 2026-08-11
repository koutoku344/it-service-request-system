from fastapi import APIRouter, Depends
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

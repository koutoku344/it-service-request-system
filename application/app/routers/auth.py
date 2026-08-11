from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud, schemas
from app.auth import get_current_user
from app.database import get_db
from app.models import User
from app.security import create_access_token, verify_password


router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/login", response_model=schemas.TokenResponse)
def login(
    login_data: schemas.LoginRequest,
    db: Session = Depends(get_db),
):
    user = crud.get_user_by_username(db, login_data.username)

    if user is None or not verify_password(
        login_data.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )

    return {
        "access_token": create_access_token(user.username),
        "token_type": "bearer",
    }


@router.get("/me", response_model=schemas.UserResponse)
def read_current_user(
    current_user: User = Depends(get_current_user),
):
    return current_user

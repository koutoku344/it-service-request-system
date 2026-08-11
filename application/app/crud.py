from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.security import hash_password


def create_request(
    db: Session,
    request_data: schemas.RequestCreate,
    applicant_name: str,
) -> models.Request:

    db_request = models.Request(
        request_type=request_data.request_type,
        title=request_data.title,
        description=request_data.description,
        applicant_name=applicant_name,
        status="pending",
    )

    db.add(db_request)
    db.commit()
    db.refresh(db_request)

    return db_request


def get_requests(
    db: Session,
) -> list[models.Request]:

    statement = (
        select(models.Request)
        .order_by(models.Request.id.desc())
    )

    return list(
        db.scalars(statement).all()
    )


def get_request(
    db: Session,
    request_id: int,
) -> models.Request | None:

    return db.get(
        models.Request,
        request_id,
    )


def cancel_request(
    db: Session,
    db_request: models.Request,
) -> models.Request:

    db_request.status = "cancelled"

    db.commit()
    db.refresh(db_request)

    return db_request


def update_request_status(
    db: Session,
    db_request: models.Request,
    new_status: str,
    approver_name: str,
    comment: str | None,
) -> models.Request:

    db_request.status = new_status

    history = models.ApprovalHistory(
        request_id=db_request.id,
        action=new_status,
        comment=comment,
        approver_name=approver_name,
    )

    db.add(history)
    db.commit()
    db.refresh(db_request)

    return db_request


def get_approval_histories(
    db: Session,
    request_id: int,
) -> list[models.ApprovalHistory]:

    statement = (
        select(models.ApprovalHistory)
        .where(models.ApprovalHistory.request_id == request_id)
        .order_by(models.ApprovalHistory.id.asc())
    )

    return list(db.scalars(statement).all())

def get_user_by_username(
    db: Session,
    username: str,
) -> models.User | None:
    statement = select(models.User).where(
        models.User.username == username
    )
    return db.scalar(statement)


def get_users(db: Session) -> list[models.User]:
    statement = select(models.User).order_by(models.User.id.asc())
    return list(db.scalars(statement).all())

def get_user(db: Session, user_id: int) -> models.User | None:
    return db.get(models.User, user_id)


def create_user(
    db: Session,
    user: schemas.UserCreate,
) -> models.User:
    db_user = models.User(
        username=user.username,
        password_hash=hash_password(user.password),
        role=user.role,
        is_active=True,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def update_user_role(
    db: Session,
    db_user: models.User,
    role: str,
) -> models.User:
    db_user.role = role
    db.commit()
    db.refresh(db_user)
    return db_user


def update_user_active(
    db: Session,
    db_user: models.User,
    is_active: bool,
) -> models.User:
    db_user.is_active = is_active
    db.commit()
    db.refresh(db_user)
    return db_user

def get_request_types(db: Session) -> list[models.RequestTypeMaster]:
    statement = select(models.RequestTypeMaster).order_by(
        models.RequestTypeMaster.id.asc()
    )
    return list(db.scalars(statement).all())


def get_request_type_by_code(
    db: Session,
    code: str,
) -> models.RequestTypeMaster | None:
    statement = select(models.RequestTypeMaster).where(
        models.RequestTypeMaster.code == code
    )
    return db.scalar(statement)


def create_request_type(
    db: Session,
    data: schemas.RequestTypeCreate,
) -> models.RequestTypeMaster:
    master = models.RequestTypeMaster(
        code=data.code,
        name=data.name,
        is_active=True,
    )
    db.add(master)
    db.commit()
    db.refresh(master)
    return master


def update_request_type(
    db: Session,
    master: models.RequestTypeMaster,
    data: schemas.RequestTypeUpdate,
) -> models.RequestTypeMaster:
    master.name = data.name
    master.is_active = data.is_active
    db.commit()
    db.refresh(master)
    return master




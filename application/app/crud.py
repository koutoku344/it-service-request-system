from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas


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



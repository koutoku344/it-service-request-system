from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas


def create_request(
    db: Session,
    request_data: schemas.RequestCreate,
) -> models.Request:

    db_request = models.Request(
        request_type=request_data.request_type,
        title=request_data.title,
        description=request_data.description,
        applicant_name=request_data.applicant_name,
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

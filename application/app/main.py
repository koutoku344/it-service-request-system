from fastapi import FastAPI
from sqlalchemy import text

from app.database import engine
from app.routers import requests


app = FastAPI(
    title="IT Service Request System API",
    version="0.2.0",
)

app.include_router(
    requests.router,
)


@app.get("/")
def root():
    return {
        "message": "IT Service Request System API",
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
    }


@app.get("/health/db")
def database_health():
    with engine.connect() as connection:
        connection.execute(
            text("SELECT 1")
        )

    return {
        "status": "ok",
        "database": "connected",
    }

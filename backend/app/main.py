from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.websockets import routes as ws_routes
import logging

from app.routers import auth, devices, establishments, queues, tickets, users
app = FastAPI(
    title=settings.APP_NAME,
    version="0.2.0",
    description="API de gestion de files d'attente virtuelles",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(establishments.router)
app.include_router(queues.router)
app.include_router(tickets.router)
app.include_router(ws_routes.router)
# Affiche aussi les messages INFO de nos modules (smartqueue.*) dans le terminal
logging.basicConfig(level=logging.INFO, format="%(levelname)s:     [%(name)s] %(message)s")
app.include_router(devices.router)

@app.get("/api/health", tags=["Santé"])
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Base de données inaccessible")
    return {"status": "ok", "database": "connected", "environment": settings.ENVIRONMENT}
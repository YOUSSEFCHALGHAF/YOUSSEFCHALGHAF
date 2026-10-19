from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db

app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    description="API de gestion de files d'attente virtuelles",
)

# Autorise le frontend React (autre port = autre "origine") à appeler l'API
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["Santé"])
def health_check(db: Session = Depends(get_db)):
    """Vérifie que l'API tourne et que MySQL répond."""
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Base de données inaccessible",
        )
    return {"status": "ok", "database": "connected", "environment": settings.ENVIRONMENT}
@app.get("/")
def root():
    return {"message": "SmartQueue API", "docs": "/docs"}
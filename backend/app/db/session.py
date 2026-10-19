from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600,
    isolation_level="READ COMMITTED",  # chaque lecture voit les données déjà validées
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    """Dépendance FastAPI : ouvre une session par requête et la ferme toujours."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
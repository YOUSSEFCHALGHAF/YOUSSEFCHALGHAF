from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.core.security import hash_password
from app.models import Role, User

if not settings.TEST_DATABASE_URL:
    raise RuntimeError("TEST_DATABASE_URL manquant dans backend/.env")

# Moteur séparé, pointant sur la base de TEST
test_engine = create_engine(
    settings.TEST_DATABASE_URL,
    pool_pre_ping=True,
    isolation_level="READ COMMITTED",
)
TestingSessionLocal = sessionmaker(bind=test_engine, autoflush=False, autocommit=False)

PASSWORD = "Secret123"
PASSWORD_HASH = hash_password(PASSWORD)  # calculé une seule fois (bcrypt est lent)


def make_user(db: Session, email: str, role: Role = Role.CLIENT) -> User:
    user = User(email=email, full_name="Utilisateur Test", role=role, password_hash=PASSWORD_HASH)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def auth_headers(client: TestClient, email: str) -> dict[str, str]:
    response = client.post("/api/auth/login", data={"username": email, "password": PASSWORD})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}
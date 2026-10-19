import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app import models  # noqa: F401  enregistre toutes les tables
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models import Establishment, EstablishmentCategory, Queue, Role
from tests.utils import TestingSessionLocal, make_user, test_engine


def override_get_db():
    """Remplace get_db : l'API utilise la base de test pendant les tests."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session", autouse=True)
def create_schema():
    """Une fois par lancement : tables créées au début, supprimées à la fin."""
    Base.metadata.drop_all(test_engine)
    Base.metadata.create_all(test_engine)
    yield
    Base.metadata.drop_all(test_engine)


@pytest.fixture(autouse=True)
def clean_tables():
    """Après chaque test : toutes les tables sont vidées (tests indépendants)."""
    yield
    with test_engine.begin() as conn:
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        for table in Base.metadata.sorted_tables:
            conn.execute(text(f"TRUNCATE TABLE {table.name}"))
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))


@pytest.fixture
def db():
    session = TestingSessionLocal()
    yield session
    session.close()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def client_user(db):
    return make_user(db, "client@example.com", Role.CLIENT)


@pytest.fixture
def merchant(db):
    return make_user(db, "merchant@example.com", Role.MERCHANT)


@pytest.fixture
def admin(db):
    return make_user(db, "admin@example.com", Role.ADMIN)


@pytest.fixture
def queue(db, merchant):
    establishment = Establishment(
        name="Bureau de poste test",
        category=EstablishmentCategory.SERVICE_PUBLIC,
        address="1 rue du Test",
        city="Ville Test",
        owner_id=merchant.id,
    )
    queue = Queue(name="Guichet", prefix="A", avg_service_minutes=5)
    establishment.queues.append(queue)
    db.add(establishment)
    db.commit()
    db.refresh(queue)
    return queue
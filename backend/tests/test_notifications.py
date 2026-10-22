from types import SimpleNamespace

import pytest
from firebase_admin import messaging
from sqlalchemy import func, select

from app.models import DeviceToken, Notification, NotificationStatus
from app.services import notification_service
from tests.utils import auth_headers, make_user


def fcm_token(name: str) -> str:
    return f"fake-fcm-token-{name}-" + "x" * 40  # >= 20 caractères, comme un vrai


class FakeFCM:
    """Remplace messaging.send_each : mémorise les messages et simule les réponses."""

    def __init__(self, error=None):
        self.sent = []
        self.error = error  # None = succès ; sinon exception renvoyée pour chaque message

    def __call__(self, messages, app=None):
        self.sent.extend(messages)
        responses = [SimpleNamespace(success=self.error is None, exception=self.error) for _ in messages]
        return SimpleNamespace(responses=responses)

    def types(self):
        return sorted(m.data["type"] for m in self.sent)


@pytest.fixture
def fake_fcm(monkeypatch):
    fake = FakeFCM()
    monkeypatch.setattr(notification_service, "get_firebase_app", lambda: object())  # "configuré"
    monkeypatch.setattr(notification_service.messaging, "send_each", fake)
    return fake


def register(client, email, token):
    return client.post("/api/devices", json={"token": token}, headers=auth_headers(client, email))


def take(client, queue_id, email):
    return client.post(f"/api/queues/{queue_id}/tickets", headers=auth_headers(client, email))


# ---------- Enregistrement des jetons ----------

def test_register_device_token(client, db, client_user):
    assert register(client, client_user.email, fcm_token("a")).status_code == 201
    device = db.scalar(select(DeviceToken))
    assert device.user_id == client_user.id
    assert device.is_valid is True


def test_register_twice_does_not_duplicate(client, db, client_user):
    register(client, client_user.email, fcm_token("a"))
    register(client, client_user.email, fcm_token("a"))
    assert db.scalar(select(func.count(DeviceToken.id))) == 1


def test_token_moves_to_last_logged_user(client, db, client_user):
    other = make_user(db, "autre@example.com")
    register(client, client_user.email, fcm_token("shared"))
    register(client, other.email, fcm_token("shared"))
    db.expire_all()  # relire la base, pas le cache de la session
    assert db.scalar(select(DeviceToken)).user_id == other.id


def test_unregister_device(client, db, client_user):
    register(client, client_user.email, fcm_token("a"))
    response = client.post(
        "/api/devices/unregister", json={"token": fcm_token("a")}, headers=auth_headers(client, client_user.email)
    )
    assert response.status_code == 204
    assert db.scalar(select(func.count(DeviceToken.id))) == 0


# ---------- Envoi ----------

def test_ticket_created_notification(client, db, client_user, queue, fake_fcm):
    register(client, client_user.email, fcm_token("a"))
    take(client, queue.id, client_user.email)

    assert fake_fcm.types() == ["TICKET_CREATED"]
    message = fake_fcm.sent[0]
    assert message.token == fcm_token("a")
    assert message.data["title"] == "Ticket A-001 confirmé"
    assert message.data["link"].startswith("/tickets/")
    assert db.scalar(select(Notification)).status == NotificationStatus.SENT


def test_call_next_sends_called_and_approaching(client, db, merchant, queue, fake_fcm):
    emails = [make_user(db, f"n{i}@example.com").email for i in range(3)]
    for i, email in enumerate(emails):
        register(client, email, fcm_token(str(i)))
        take(client, queue.id, email)
    fake_fcm.sent.clear()  # on ignore les 3 "ticket créé"

    client.post(f"/api/queues/{queue.id}/call-next", headers=auth_headers(client, merchant.email))

    # A-001 appelé ; A-002 (position 1) et A-003 (position 2) prévenus (notify_before = 2)
    assert fake_fcm.types() == ["TICKET_CALLED", "TURN_APPROACHING", "TURN_APPROACHING"]
    called = next(m for m in fake_fcm.sent if m.data["type"] == "TICKET_CALLED")
    assert called.token == fcm_token("0")


def test_turn_approaching_sent_only_once(client, db, merchant, queue, fake_fcm):
    emails = [make_user(db, f"o{i}@example.com").email for i in range(3)]
    for i, email in enumerate(emails):
        register(client, email, fcm_token(str(i)))
        take(client, queue.id, email)
    headers = auth_headers(client, merchant.email)
    client.post(f"/api/queues/{queue.id}/call-next", headers=headers)
    fake_fcm.sent.clear()

    client.post(f"/api/queues/{queue.id}/call-next", headers=headers)

    # A-002 appelé ; A-003 avait déjà reçu "votre tour approche" : pas de doublon
    assert fake_fcm.types() == ["TICKET_CALLED"]


def test_invalid_token_is_disabled(client, db, client_user, queue, monkeypatch):
    fake = FakeFCM(error=messaging.UnregisteredError("Jeton non enregistré"))
    monkeypatch.setattr(notification_service, "get_firebase_app", lambda: object())
    monkeypatch.setattr(notification_service.messaging, "send_each", fake)

    register(client, client_user.email, fcm_token("dead"))
    take(client, queue.id, client_user.email)

    db.expire_all()
    assert db.scalar(select(DeviceToken)).is_valid is False
    notification = db.scalar(select(Notification))
    assert notification.status == NotificationStatus.FAILED
    assert "UnregisteredError" in notification.error


def test_without_firebase_everything_still_works(client, db, client_user, queue):
    # fixture autouse : Firebase "non configuré"
    register(client, client_user.email, fcm_token("a"))
    assert take(client, queue.id, client_user.email).status_code == 201
    assert db.scalar(select(func.count(Notification.id))) == 0


def test_test_endpoint_without_firebase(client, client_user):
    response = client.post("/api/devices/test", headers=auth_headers(client, client_user.email))
    assert response.status_code == 503
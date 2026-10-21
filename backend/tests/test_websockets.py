import json

import pytest
from starlette.websockets import WebSocketDisconnect

from app.websockets.manager import manager
from tests.utils import auth_headers, get_token, make_user


def ws_url(queue_id: int, token: str | None = None) -> str:
    url = f"/ws/queues/{queue_id}"
    return f"{url}?token={token}" if token else url


def take_ticket(client, queue_id: int, email: str):
    return client.post(f"/api/queues/{queue_id}/tickets", headers=auth_headers(client, email))


# ---------- Sécurité de la connexion ----------

def test_ws_rejects_missing_token(client, queue):
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect(ws_url(queue.id)) as ws:
            ws.receive_json()
    assert exc.value.code == 4401


def test_ws_rejects_invalid_token(client, queue):
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect(ws_url(queue.id, "abc.def.ghi")) as ws:
            ws.receive_json()
    assert exc.value.code == 4401


def test_ws_rejects_unknown_queue(client, client_user):
    token = get_token(client, client_user.email)
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect(ws_url(9999, token)) as ws:
            ws.receive_json()
    assert exc.value.code == 4404


# ---------- Diffusion ----------

def test_ws_snapshot_then_ticket_created(client, client_user, merchant, queue):
    token = get_token(client, merchant.email)
    with client.websocket_connect(ws_url(queue.id, token)) as ws:
        snapshot = ws.receive_json()
        assert snapshot["event"] == "snapshot"
        assert snapshot["queue"]["waiting_count"] == 0
        assert manager.count(queue.id) == 1

        assert take_ticket(client, queue.id, client_user.email).status_code == 201

        message = ws.receive_json()
        assert message["event"] == "ticket_created"
        assert message["ticket"]["code"] == "A-001"
        assert message["queue"]["waiting_numbers"] == [1]


def test_two_listeners_receive_ticket_called(client, db, merchant, queue):
    emails = [make_user(db, f"w{i}@example.com").email for i in range(2)]
    for email in emails:
        take_ticket(client, queue.id, email)
    tokens = [get_token(client, email) for email in emails]

    with client.websocket_connect(ws_url(queue.id, tokens[0])) as ws_a, \
         client.websocket_connect(ws_url(queue.id, tokens[1])) as ws_b:
        assert ws_a.receive_json()["queue"]["waiting_numbers"] == [1, 2]
        assert ws_b.receive_json()["queue"]["waiting_numbers"] == [1, 2]

        client.post(f"/api/queues/{queue.id}/call-next", headers=auth_headers(client, merchant.email))

        for ws in (ws_a, ws_b):
            message = ws.receive_json()
            assert message["event"] == "ticket_called"
            assert message["queue"]["current_code"] == "A-001"
            assert message["queue"]["waiting_numbers"] == [2]  # le 2e client est maintenant 1er


def test_messages_contain_no_personal_data(client, client_user, merchant, queue):
    token = get_token(client, merchant.email)
    with client.websocket_connect(ws_url(queue.id, token)) as ws:
        ws.receive_json()  # snapshot
        take_ticket(client, queue.id, client_user.email)
        message = ws.receive_json()

    assert set(message["ticket"]) == {"id", "code", "number", "status"}
    raw = json.dumps(message)
    assert client_user.email not in raw
    assert "user_id" not in raw


def test_ping_pong(client, client_user, queue):
    token = get_token(client, client_user.email)
    with client.websocket_connect(ws_url(queue.id, token)) as ws:
        ws.receive_json()  # snapshot
        ws.send_text("ping")
        assert ws.receive_text() == "pong"
from app.models import Role
from tests.utils import auth_headers, make_user


def take(client, queue_id, email):
    return client.post(f"/api/queues/{queue_id}/tickets", headers=auth_headers(client, email))


def test_take_ticket(client, client_user, queue):
    response = take(client, queue.id, client_user.email)
    assert response.status_code == 201
    body = response.json()
    assert body["code"] == "A-001"
    assert body["status"] == "WAITING"
    assert body["position"] == 1
    assert body["estimated_wait_minutes"] == 5  # 1 x 5 min (aucun historique)


def test_one_active_ticket_per_queue(client, client_user, queue):
    assert take(client, queue.id, client_user.email).status_code == 201
    second = take(client, queue.id, client_user.email)
    assert second.status_code == 409


def test_closed_queue_refuses_tickets(client, db, client_user, queue):
    queue.is_open = False
    db.commit()
    response = take(client, queue.id, client_user.email)
    assert response.status_code == 409
    assert response.json()["detail"] == "La file est fermée"


def test_merchant_cannot_take_ticket(client, merchant, queue):
    assert take(client, queue.id, merchant.email).status_code == 403


def test_call_next_updates_positions(client, db, merchant, queue):
    emails = [make_user(db, f"c{i}@example.com").email for i in range(3)]
    tickets = [take(client, queue.id, email).json() for email in emails]
    assert [t["code"] for t in tickets] == ["A-001", "A-002", "A-003"]

    response = client.post(
        f"/api/queues/{queue.id}/call-next", headers=auth_headers(client, merchant.email)
    )
    assert response.status_code == 200
    assert response.json()["code"] == "A-001"
    assert response.json()["status"] == "CALLED"

    third = client.get(f"/api/tickets/{tickets[2]['id']}", headers=auth_headers(client, emails[2]))
    assert third.json()["position"] == 2  # était 3, A-001 a été appelé


def test_call_next_closes_previous_ticket(client, db, merchant, queue):
    for i in range(2):
        take(client, queue.id, make_user(db, f"p{i}@example.com").email)
    headers = auth_headers(client, merchant.email)
    first = client.post(f"/api/queues/{queue.id}/call-next", headers=headers).json()
    client.post(f"/api/queues/{queue.id}/call-next", headers=headers)
    previous = client.get(f"/api/tickets/{first['id']}", headers=headers).json()
    assert previous["status"] == "SERVED"  # RG-07


def test_other_merchant_is_forbidden(client, db, queue):
    other = make_user(db, "autre@example.com", Role.MERCHANT)
    response = client.post(
        f"/api/queues/{queue.id}/call-next", headers=auth_headers(client, other.email)
    )
    assert response.status_code == 403


def test_call_next_on_empty_queue(client, merchant, queue):
    response = client.post(
        f"/api/queues/{queue.id}/call-next", headers=auth_headers(client, merchant.email)
    )
    assert response.status_code == 404


def test_client_cancels_ticket(client, client_user, queue):
    ticket = take(client, queue.id, client_user.email).json()
    headers = auth_headers(client, client_user.email)
    response = client.post(f"/api/tickets/{ticket['id']}/cancel", headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "CANCELLED"
    assert response.json()["position"] is None
    # Une seconde annulation est refusée
    assert client.post(f"/api/tickets/{ticket['id']}/cancel", headers=headers).status_code == 409


def test_no_show_appears_in_history(client, client_user, merchant, queue):
    ticket = take(client, queue.id, client_user.email).json()
    merchant_headers = auth_headers(client, merchant.email)
    client.post(f"/api/queues/{queue.id}/call-next", headers=merchant_headers)
    response = client.patch(
        f"/api/tickets/{ticket['id']}/status", json={"status": "NO_SHOW"}, headers=merchant_headers
    )
    assert response.status_code == 200

    history = client.get("/api/tickets/me", headers=auth_headers(client, client_user.email)).json()
    assert history[0]["status"] == "NO_SHOW"
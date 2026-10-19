from tests.utils import PASSWORD, auth_headers


def test_register_creates_client(client):
    response = client.post(
        "/api/auth/register",
        json={"email": "Nouveau@Example.com", "password": "Motdepasse1", "full_name": "Nadia Test"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "nouveau@example.com"  # e-mail normalisé en minuscules
    assert body["role"] == "CLIENT"
    assert "password_hash" not in body


def test_register_duplicate_email(client, client_user):
    response = client.post(
        "/api/auth/register",
        json={"email": "client@example.com", "password": "Motdepasse1", "full_name": "Doublon"},
    )
    assert response.status_code == 409


def test_register_weak_password(client):
    response = client.post(
        "/api/auth/register",
        json={"email": "faible@example.com", "password": "court", "full_name": "Faible"},
    )
    assert response.status_code == 422


def test_login_and_me(client, client_user):
    headers = auth_headers(client, "client@example.com")
    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 200
    assert response.json()["email"] == "client@example.com"


def test_login_wrong_password(client, client_user):
    response = client.post(
        "/api/auth/login", data={"username": "client@example.com", "password": "Mauvais999"}
    )
    assert response.status_code == 401


def test_me_without_token(client):
    assert client.get("/api/auth/me").status_code == 401


def test_inactive_user_cannot_login(client, db, client_user):
    client_user.is_active = False
    db.commit()
    response = client.post(
        "/api/auth/login", data={"username": "client@example.com", "password": PASSWORD}
    )
    assert response.status_code == 403


def test_client_cannot_list_users(client, client_user):
    headers = auth_headers(client, "client@example.com")
    assert client.get("/api/users", headers=headers).status_code == 403
from datetime import datetime

import jwt
from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import Queue, User
from app.services.queue_service import queue_snapshot
from app.websockets.events import SNAPSHOT
from app.websockets.manager import manager

router = APIRouter()

WS_UNAUTHORIZED = 4401
WS_NOT_FOUND = 4404


def _authorize(db: Session, token: str | None, queue_id: int) -> tuple[int, dict | None]:
    """Code synchrone (accès MySQL). Retourne (code_erreur, instantané).
    code_erreur = 0 si tout est correct."""
    if not token:
        return WS_UNAUTHORIZED, None
    try:
        payload = decode_access_token(token)  # vérifie signature ET expiration
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return WS_UNAUTHORIZED, None

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        return WS_UNAUTHORIZED, None

    queue = db.get(Queue, queue_id)
    if queue is None or not queue.establishment.is_active:
        return WS_NOT_FOUND, None

    return 0, queue_snapshot(db, queue)


@router.websocket("/ws/queues/{queue_id}")
async def queue_updates(
    websocket: WebSocket,
    queue_id: int,
    token: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    await websocket.accept()

    try:
        # Les requêtes MySQL sont bloquantes : on les exécute dans un thread
        # pour ne pas figer la boucle asynchrone (et les autres WebSockets).
        error_code, snapshot = await run_in_threadpool(_authorize, db, token, queue_id)
    finally:
        db.close()  # rend la connexion MySQL au pool tout de suite

    if error_code:
        await websocket.close(code=error_code)
        return

    manager.connect(queue_id, websocket)  # inscrit AVANT d'envoyer : aucun événement manqué
    try:
        await websocket.send_json(
            {
                "event": SNAPSHOT,
                "queue": snapshot,
                "ticket": None,
                "sent_at": datetime.now().isoformat(timespec="seconds"),
            }
        )
        while True:
            # On attend les messages du navigateur ; seul "ping" est prévu
            text = await websocket.receive_text()
            if text == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass  # le client est parti : cas normal
    finally:
        manager.disconnect(queue_id, websocket)
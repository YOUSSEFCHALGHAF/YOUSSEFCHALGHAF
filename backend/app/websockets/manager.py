import logging
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger("smartqueue.websockets")


class ConnectionManager:
    """Garde en mémoire les connexions WebSocket, regroupées par file d'attente.

    Toutes les méthodes s'exécutent dans la boucle asynchrone d'Uvicorn,
    qui ne fait qu'une chose à la fois : pas besoin de verrou.
    """

    def __init__(self) -> None:
        self._rooms: dict[int, set[WebSocket]] = defaultdict(set)

    def connect(self, queue_id: int, websocket: WebSocket) -> None:
        """Inscrit une connexion déjà acceptée dans la salle de la file."""
        self._rooms[queue_id].add(websocket)
        logger.info("WS connecté à la file %s (%s connexions)", queue_id, self.count(queue_id))

    def disconnect(self, queue_id: int, websocket: WebSocket) -> None:
        room = self._rooms.get(queue_id)
        if room is None:
            return
        room.discard(websocket)          # discard : pas d'erreur si déjà retiré
        if not room:
            del self._rooms[queue_id]    # on ne garde pas de salles vides
        logger.info("WS déconnecté de la file %s", queue_id)

    def count(self, queue_id: int) -> int:
        return len(self._rooms.get(queue_id, ()))

    async def broadcast(self, queue_id: int, message: dict[str, Any]) -> None:
        """Envoie le message à toutes les connexions de la file."""
        # Copie de l'ensemble : il peut changer pendant les "await" ci-dessous
        targets = list(self._rooms.get(queue_id, ()))
        dead: list[WebSocket] = []
        for websocket in targets:
            try:
                await websocket.send_json(message)
            except Exception:            # onglet fermé brutalement, réseau coupé...
                dead.append(websocket)
        for websocket in dead:
            self.disconnect(queue_id, websocket)


# Instance unique partagée par toute l'application
manager = ConnectionManager()
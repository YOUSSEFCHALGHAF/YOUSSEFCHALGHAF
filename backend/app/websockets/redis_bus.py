# app/websockets/redis_bus.py  -- évolution future
import json

import redis.asyncio as redis

from app.websockets.manager import manager

bus = redis.from_url("redis://localhost:6379/0")


async def publish_shared(queue_id: int, message: dict) -> None:
    """Remplacerait manager.broadcast dans events.publish."""
    await bus.publish(f"queue:{queue_id}", json.dumps(message))


async def listen_forever() -> None:
    """Lancée au démarrage de chaque processus (lifespan FastAPI)."""
    pubsub = bus.pubsub()
    await pubsub.psubscribe("queue:*")
    async for item in pubsub.listen():
        if item["type"] == "pmessage":
            queue_id = int(item["channel"].decode().split(":")[1])
            await manager.broadcast(queue_id, json.loads(item["data"]))
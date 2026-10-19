from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditLog, User


def log_action(
    db: Session,
    actor: User | None,
    action: str,
    entity_type: str,
    entity_id: int,
    details: dict[str, Any] | None = None,
) -> None:
    """Ajoute une ligne au journal. Pas de commit ici : la ligne est validée
    en même temps que l'opération (tout ou rien)."""
    db.add(
        AuditLog(
            actor_id=actor.id if actor else None,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
        )
    )
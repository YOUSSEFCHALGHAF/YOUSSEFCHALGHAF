from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models import DeviceToken, NotificationType, User
from app.schemas.device import DeviceTokenCreate, DeviceTokenDelete
from app.services import notification_service

router = APIRouter(prefix="/api/devices", tags=["Notifications"])


@router.post("", status_code=status.HTTP_201_CREATED)
def register_device(
    payload: DeviceTokenCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Enregistre le jeton FCM. Idempotent : peut être appelé à chaque visite."""
    device = db.scalar(select(DeviceToken).where(DeviceToken.token == payload.token))
    if device is None:
        db.add(DeviceToken(token=payload.token, user_id=user.id, user_agent=payload.user_agent))
    else:
        # Appareil partagé : le jeton appartient au dernier compte connecté
        device.user_id = user.id
        device.is_valid = True
        device.user_agent = payload.user_agent
        device.last_seen_at = datetime.now()
    try:
        db.commit()
    except IntegrityError:  # deux enregistrements simultanés du même jeton
        db.rollback()
    return {"status": "registered"}


@router.post("/unregister", status_code=status.HTTP_204_NO_CONTENT)
def unregister_device(
    payload: DeviceTokenDelete,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    device = db.scalar(
        select(DeviceToken).where(DeviceToken.token == payload.token, DeviceToken.user_id == user.id)
    )
    if device is not None:
        db.delete(device)
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/test")
def send_test_notification(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if notification_service.get_firebase_app() is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Firebase n'est pas configuré sur le serveur")
    delivered = notification_service.send_to_user(
        db, user.id, NotificationType.QUEUE_UPDATE,
        "Test SmartQueue", "Les notifications fonctionnent sur cet appareil.", link="/",
    )
    if not delivered:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Aucun appareil n'a reçu la notification (jeton absent ou invalide)",
        )
    return {"status": "sent"}
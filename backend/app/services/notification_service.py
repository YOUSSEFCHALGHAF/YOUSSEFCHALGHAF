"""Envoi des notifications web avec Firebase Cloud Messaging (Admin SDK)."""
import logging
import threading
from datetime import date
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, exceptions, messaging
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models import (
    DeviceToken, Notification, NotificationStatus, NotificationType, Queue, Ticket, TicketStatus,
)

logger = logging.getLogger("smartqueue.notifications")

# Fabrique de sessions des tâches de fond (remplacée par la base de test dans conftest.py)
SessionFactory = SessionLocal

# Erreurs FCM signifiant « ce jeton ne fonctionnera plus jamais »
PERMANENT_TOKEN_ERRORS = (
    messaging.UnregisteredError,        # application désinstallée, autorisation retirée, jeton expiré
    messaging.SenderIdMismatchError,    # jeton créé pour un autre projet Firebase
    exceptions.InvalidArgumentError,    # jeton mal formé
)

_firebase_app = None
_firebase_checked = False
_init_lock = threading.Lock()  # plusieurs tâches de fond peuvent démarrer en même temps


def get_firebase_app():
    """Initialise Firebase une seule fois. Retourne None si non configuré."""
    global _firebase_app, _firebase_checked
    with _init_lock:
        if _firebase_checked:
            return _firebase_app
        _firebase_checked = True
        path = settings.FIREBASE_CREDENTIALS_PATH
        if not path or not Path(path).is_file():
            logger.warning("Notifications désactivées : compte de service introuvable (%s)", path)
            return None
        try:
            _firebase_app = firebase_admin.initialize_app(credentials.Certificate(path))
            logger.info("Firebase initialisé")
        except (ValueError, OSError) as error:
            logger.error("Initialisation Firebase impossible : %s", error)
        return _firebase_app


def send_to_user(
    db: Session,
    user_id: int,
    notif_type: NotificationType,
    title: str,
    body: str,
    ticket_id: int | None = None,
    link: str = "/",
) -> bool:
    """Envoie une notification à tous les appareils valides de l'utilisateur.
    Retourne True si au moins un appareil l'a reçue."""
    devices = list(
        db.scalars(
            select(DeviceToken).where(DeviceToken.user_id == user_id, DeviceToken.is_valid.is_(True))
        )
    )
    if not devices:
        return False  # notifications non activées par l'utilisateur
    app = get_firebase_app()
    if app is None:
        return False  # Firebase non configuré : on ignore sans erreur

    # Message "data" uniquement : toutes les valeurs doivent être des chaînes
    data = {
        "type": notif_type.value,
        "title": title,
        "body": body,
        "link": link,
        "tag": f"ticket-{ticket_id}" if ticket_id else "smartqueue",
    }
    webpush = messaging.WebpushConfig(
        headers={"Urgency": "high", "TTL": "900"}  # livraison rapide ; abandon après 15 min
    )
    messages = [messaging.Message(token=d.token, data=data, webpush=webpush) for d in devices]

    successes = 0
    errors: list[str] = []
    try:
        batch = messaging.send_each(messages, app=app)  # un envoi par appareil
        for device, result in zip(devices, batch.responses):
            if result.success:
                successes += 1
                continue
            errors.append(f"{type(result.exception).__name__}: {result.exception}")
            if isinstance(result.exception, PERMANENT_TOKEN_ERRORS):
                device.is_valid = False  # on n'essaiera plus ce jeton
    except Exception as error:  # panne réseau, identifiants refusés... : ne jamais planter
        logger.exception("Envoi FCM impossible")
        errors.append(str(error))

    db.add(
        Notification(
            user_id=user_id,
            ticket_id=ticket_id,
            type=notif_type,
            title=title,
            body=body,
            status=NotificationStatus.SENT if successes else NotificationStatus.FAILED,
            error="; ".join(errors)[:2000] or None,
        )
    )
    db.commit()
    return successes > 0


# ---------- Tâches de fond (appelées après le commit, voir section 4) ----------

def _ticket_link(ticket: Ticket) -> str:
    return f"/tickets/{ticket.id}"  # chemin relatif : le service worker ajoute le domaine


def notify_ticket_created(ticket_id: int) -> None:
    with SessionFactory() as db:
        ticket = db.get(Ticket, ticket_id)
        if ticket is None:
            return
        queue = ticket.queue
        send_to_user(
            db, ticket.user_id, NotificationType.TICKET_CREATED,
            f"Ticket {ticket.code} confirmé",
            f"{queue.establishment.name} · {queue.name}. Nous vous préviendrons avant votre tour.",
            ticket.id, _ticket_link(ticket),
        )


def notify_ticket_called(ticket_id: int) -> None:
    with SessionFactory() as db:
        ticket = db.get(Ticket, ticket_id)
        if ticket is None or ticket.status != TicketStatus.CALLED:
            return
        send_to_user(
            db, ticket.user_id, NotificationType.TICKET_CALLED,
            "C’est votre tour !",
            f"Ticket {ticket.code} — présentez-vous : {ticket.queue.name}.",
            ticket.id, _ticket_link(ticket),
        )


def notify_turn_approaching(queue_id: int) -> None:
    """Prévient les tickets des positions 1 à notify_before, une seule fois chacun (RG-06)."""
    with SessionFactory() as db:
        queue = db.get(Queue, queue_id)
        if queue is None:
            return
        first_waiting = db.scalars(
            select(Ticket)
            .where(
                Ticket.queue_id == queue.id,
                Ticket.service_date == date.today(),
                Ticket.status == TicketStatus.WAITING,
            )
            .order_by(Ticket.number)
            .limit(queue.notify_before)
        ).all()

        for position, ticket in enumerate(first_waiting, start=1):
            already_sent = db.scalar(
                select(Notification.id).where(
                    Notification.ticket_id == ticket.id,
                    Notification.type == NotificationType.TURN_APPROACHING,
                )
            )
            if already_sent:
                continue
            body = (
                "Vous êtes le prochain : rapprochez-vous du guichet."
                if position == 1
                else f"Plus que {position - 1} personne(s) avant vous."
            )
            send_to_user(
                db, ticket.user_id, NotificationType.TURN_APPROACHING,
                f"Votre tour approche ({ticket.code})", body,
                ticket.id, _ticket_link(ticket),
            )
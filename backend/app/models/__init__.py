"""Importer ce package enregistre toutes les tables dans Base.metadata."""
from app.models.audit_log import AuditLog
from app.models.device_token import DeviceToken
from app.models.establishment import Establishment, EstablishmentCategory
from app.models.notification import Notification, NotificationStatus, NotificationType
from app.models.queue import Queue
from app.models.ticket import Ticket, TicketStatus
from app.models.user import Role, User

__all__ = [
    "AuditLog", "DeviceToken", "Establishment", "EstablishmentCategory",
    "Notification", "NotificationStatus", "NotificationType",
    "Queue", "Ticket", "TicketStatus", "Role", "User",
]
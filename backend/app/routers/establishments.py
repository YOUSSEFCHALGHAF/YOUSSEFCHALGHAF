from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models import Establishment, EstablishmentCategory, Queue, Role, User
from app.schemas.establishment import EstablishmentCreate, EstablishmentRead, EstablishmentUpdate
from app.schemas.queue import QueueCreate, QueueRead
from app.services.audit_service import log_action
from app.services.queue_service import ensure_can_manage_establishment, queue_to_read

router = APIRouter(prefix="/api/establishments", tags=["Établissements"])


def _get_establishment_or_404(db: Session, establishment_id: int) -> Establishment:
    establishment = db.get(Establishment, establishment_id)
    if establishment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Établissement introuvable")
    return establishment


def _check_owner(db: Session, owner_id: int | None) -> None:
    if owner_id is None:
        return
    owner = db.get(User, owner_id)
    if owner is None or owner.role != Role.MERCHANT:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "owner_id doit désigner un commerçant")


# --- Public : consultation et recherche (BF-03) ---

@router.get("", response_model=list[EstablishmentRead])
def list_establishments(
    search: str | None = None,
    category: EstablishmentCategory | None = None,
    city: str | None = None,
    db: Session = Depends(get_db),
):
    stmt = select(Establishment).where(Establishment.is_active.is_(True)).order_by(Establishment.name)
    if search:
        stmt = stmt.where(Establishment.name.ilike(f"%{search}%"))
    if category:
        stmt = stmt.where(Establishment.category == category)
    if city:
        stmt = stmt.where(Establishment.city.ilike(f"%{city}%"))
    return db.scalars(stmt).all()


# /mine AVANT /{establishment_id}, sinon FastAPI essaierait de lire "mine" comme un nombre
@router.get("/mine", response_model=list[EstablishmentRead])
def my_establishments(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.MERCHANT, Role.ADMIN)),
):
    stmt = select(Establishment).order_by(Establishment.name)
    if user.role == Role.MERCHANT:
        stmt = stmt.where(Establishment.owner_id == user.id)
    return db.scalars(stmt).all()  # l'admin voit tout, y compris les désactivés


@router.get("/{establishment_id}", response_model=EstablishmentRead)
def get_establishment(establishment_id: int, db: Session = Depends(get_db)):
    establishment = _get_establishment_or_404(db, establishment_id)
    if not establishment.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Établissement introuvable")
    return establishment


@router.get("/{establishment_id}/queues", response_model=list[QueueRead])
def list_establishment_queues(establishment_id: int, db: Session = Depends(get_db)):
    establishment = _get_establishment_or_404(db, establishment_id)
    return [queue_to_read(db, queue) for queue in establishment.queues]


# --- Administrateur : gestion des établissements (BF-15) ---

@router.post("", response_model=EstablishmentRead, status_code=status.HTTP_201_CREATED)
def create_establishment(
    payload: EstablishmentCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(Role.ADMIN)),
):
    _check_owner(db, payload.owner_id)
    establishment = Establishment(**payload.model_dump())
    db.add(establishment)
    db.flush()
    log_action(db, admin, "ESTABLISHMENT_CREATED", "establishment", establishment.id)
    db.commit()
    db.refresh(establishment)
    return establishment


@router.patch("/{establishment_id}", response_model=EstablishmentRead)
def update_establishment(
    establishment_id: int,
    payload: EstablishmentUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles(Role.ADMIN)),
):
    establishment = _get_establishment_or_404(db, establishment_id)
    changes = payload.model_dump(exclude_unset=True)  # seulement les champs envoyés
    if "owner_id" in changes:
        _check_owner(db, changes["owner_id"])
    for field, value in changes.items():
        setattr(establishment, field, value)
    log_action(db, admin, "ESTABLISHMENT_UPDATED", "establishment", establishment.id,
               payload.model_dump(exclude_unset=True, mode="json"))
    db.commit()
    db.refresh(establishment)
    return establishment


# --- Commerçant : créer une file dans son établissement (BF-09) ---

@router.post("/{establishment_id}/queues", response_model=QueueRead, status_code=status.HTTP_201_CREATED)
def create_queue(
    establishment_id: int,
    payload: QueueCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.MERCHANT, Role.ADMIN)),
):
    establishment = _get_establishment_or_404(db, establishment_id)
    ensure_can_manage_establishment(establishment, user)
    queue = Queue(establishment_id=establishment.id, **payload.model_dump())
    db.add(queue)
    db.flush()
    log_action(db, user, "QUEUE_CREATED", "queue", queue.id)
    db.commit()
    db.refresh(queue)
    return queue_to_read(db, queue)
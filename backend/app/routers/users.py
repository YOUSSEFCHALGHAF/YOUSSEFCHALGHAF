from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models import Role, User
from app.schemas.user import UserAdminUpdate, UserRead
from app.services.audit_service import log_action

router = APIRouter(prefix="/api/users", tags=["Utilisateurs (admin)"])
admin_only = require_roles(Role.ADMIN)


@router.get("", response_model=list[UserRead])
def list_users(
    role: Role | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(admin_only),
):
    stmt = select(User).order_by(User.created_at.desc())
    if role:
        stmt = stmt.where(User.role == role)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(or_(User.email.ilike(pattern), User.full_name.ilike(pattern)))
    return db.scalars(stmt).all()


@router.patch("/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    payload: UserAdminUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(admin_only),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Utilisateur introuvable")
    if user.id == admin.id and (
        (payload.role is not None and payload.role != Role.ADMIN) or payload.is_active is False
    ):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Vous ne pouvez pas retirer vos propres droits")

    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active
    log_action(db, admin, "USER_UPDATED", "user", user.id, payload.model_dump(exclude_none=True, mode="json"))
    db.commit()
    db.refresh(user)
    return user
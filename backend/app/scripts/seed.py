"""Crée des comptes et des établissements de démonstration.

Lancement (dossier backend, venv activé) :  python -m app.scripts.seed
Le script peut être relancé sans créer de doublons.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import Establishment, EstablishmentCategory, Queue, Role, User

DEMO_PASSWORD = "Demo2026!"


def get_or_create_user(db: Session, email: str, full_name: str, role: Role) -> User:
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(
            email=email,
            full_name=full_name,
            role=role,
            password_hash=hash_password(DEMO_PASSWORD),
        )
        db.add(user)
        db.flush()  # envoie l'INSERT pour obtenir user.id sans valider la transaction
    return user


def create_establishment(db: Session, name: str, **fields) -> None:
    if db.scalar(select(Establishment).where(Establishment.name == name)) is None:
        queues = fields.pop("queues")
        establishment = Establishment(name=name, **fields)
        establishment.queues = queues
        db.add(establishment)


def main() -> None:
    db = SessionLocal()
    try:
        get_or_create_user(db, "admin@example.com", "Administrateur", Role.ADMIN)
        poste = get_or_create_user(db, "poste@example.com", "Agent du bureau de poste", Role.MERCHANT)
        salon = get_or_create_user(db, "salon@example.com", "Gérant du salon", Role.MERCHANT)
        get_or_create_user(db, "client@example.com", "Client Démo", Role.CLIENT)
        get_or_create_user(db, "client2@example.com", "Cliente Démo", Role.CLIENT)

        create_establishment(
            db, "Bureau de poste - Centre",
            category=EstablishmentCategory.SERVICE_PUBLIC,
            address="12 avenue Principale", city="Ville Démo", phone="70 000 001",
            owner=poste,
            queues=[
                Queue(name="Courrier et colis", prefix="A", avg_service_minutes=4),
                Queue(name="Services financiers", prefix="B", avg_service_minutes=7),
            ],
        )
        create_establishment(
            db, "Salon Coupe Nette",
            category=EstablishmentCategory.BEAUTE,
            address="5 rue des Fleurs", city="Ville Démo", phone="70 000 002",
            owner=salon,
            queues=[Queue(name="Coiffure sans rendez-vous", prefix="C", avg_service_minutes=20)],
        )
        db.commit()
        print(f"Données de démonstration prêtes. Mot de passe commun : {DEMO_PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
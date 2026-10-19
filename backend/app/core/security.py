from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import settings

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    """Retourne l'empreinte bcrypt (avec sel aléatoire) du mot de passe."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Compare un mot de passe saisi à l'empreinte enregistrée."""
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(user_id: int, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),  # "subject" : identifiant de l'utilisateur (chaîne obligatoire)
        "role": role,
        "exp": expire,        # date d'expiration vérifiée automatiquement par PyJWT
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Lève jwt.PyJWTError si le jeton est falsifié, mal formé ou expiré."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
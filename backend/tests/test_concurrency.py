from concurrent.futures import ThreadPoolExecutor

from app.models import User
from app.services import ticket_service
from tests.utils import TestingSessionLocal, make_user

NB_CLIENTS = 20


def test_simultaneous_tickets_get_unique_numbers(db, queue):
    user_ids = [make_user(db, f"rush{i}@example.com").id for i in range(NB_CLIENTS)]
    queue_id = queue.id

    def take_ticket_in_own_session(user_id: int) -> int:
        # Chaque "client" a sa propre session, donc sa propre connexion MySQL,
        # exactement comme des requêtes HTTP parallèles
        session = TestingSessionLocal()
        try:
            user = session.get(User, user_id)
            return ticket_service.take_ticket(session, queue_id, user).number
        finally:
            session.close()

    with ThreadPoolExecutor(max_workers=10) as executor:  # 10 demandes à la fois
        numbers = list(executor.map(take_ticket_in_own_session, user_ids))

    assert sorted(numbers) == list(range(1, NB_CLIENTS + 1))  # 1..20, aucun doublon, aucun trou
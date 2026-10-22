// Traductions des valeurs renvoyées par l'API (enums Python de l'étape 3)
export const CATEGORY_LABELS = {
  COMMERCE: "Commerce",
  SANTE: "Santé",
  BEAUTE: "Beauté",
  SERVICE_PUBLIC: "Service public",
};

export const STATUS_LABELS = {
  WAITING: "En attente",
  CALLED: "Appelé",
  SERVED: "Servi",
  NO_SHOW: "Absent",
  CANCELLED: "Annulé",
};

export const ROLE_LABELS = {
  CLIENT: "Client",
  MERCHANT: "Commerçant",
  ADMIN: "Administrateur",
};

// Page d'arrivée après connexion, selon le rôle
export function homePathFor(role) {
  if (role === "ADMIN") return "/admin/establishments";
  if (role === "MERCHANT") return "/merchant";
  return "/establishments";
}

// Seuil d'alerte « votre tour approche » (même valeur que notify_before par défaut)
export const APPROACHING_POSITION = 2;
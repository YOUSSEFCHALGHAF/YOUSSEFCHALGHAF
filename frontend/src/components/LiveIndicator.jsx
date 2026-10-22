// Affiche l'état de la connexion WebSocket renvoyé par useQueueSocket
const STATES = {
  open: ["bg-green-500", "Temps réel actif"],
  connecting: ["bg-amber-400", "Connexion…"],
  reconnecting: ["bg-amber-400", "Reconnexion…"],
  unauthorized: ["bg-red-500", "Session expirée"],
  not_found: ["bg-red-500", "File introuvable"],
  idle: ["bg-slate-300", "Hors ligne"],
};

export default function LiveIndicator({ status }) {
  const [color, label] = STATES[status] ?? STATES.idle;
  return (
    <span className="inline-flex items-center gap-2 text-xs text-slate-500">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}
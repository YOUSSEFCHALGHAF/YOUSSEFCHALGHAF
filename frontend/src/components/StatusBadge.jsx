import { STATUS_LABELS } from "../utils/constants.js";

const COLORS = {
  WAITING: "bg-blue-100 text-blue-800",
  CALLED: "bg-green-100 text-green-800",
  SERVED: "bg-slate-100 text-slate-700",
  NO_SHOW: "bg-amber-100 text-amber-800",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function StatusBadge({ status }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${COLORS[status] ?? ""}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
const STYLES = {
  error: "border-red-200 bg-red-50 text-red-800",
  success: "border-green-200 bg-green-50 text-green-800",
  info: "border-blue-200 bg-blue-50 text-blue-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
};

export default function Alert({ type = "info", children }) {
  if (!children) return null; // rien à afficher
  return (
    <div role="alert" className={`rounded-lg border px-4 py-3 text-sm ${STYLES[type]}`}>
      {children}
    </div>
  );
}
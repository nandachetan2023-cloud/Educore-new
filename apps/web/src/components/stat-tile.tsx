export function StatTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card p-6">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

'use client';

/**
 * Small dependency-free SVG chart primitives. Good enough for dashboard
 * trend lines and bar comparisons without pulling in a charting library.
 */

export function LineChart({
  data,
  height = 160,
  color = 'rgb(var(--brand-primary))',
  formatValue,
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  formatValue?: (n: number) => string;
}) {
  const width = 600;
  const padding = 8;
  const max = Math.max(1, ...data.map((d) => d.value));
  const stepX = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = padding + i * stepX;
    const y = height - padding - (d.value / max) * (height - padding * 2);
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1]?.x ?? 0},${height - padding} L${padding},${height - padding} Z`;

  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full overflow-visible" preserveAspectRatio="none">
      <defs>
        <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {data.length > 0 && <path d={areaPath} fill="url(#lineFill)" />}
      <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {last && <circle cx={last.x} cy={last.y} r={3.5} fill={color} />}
      {last && (
        <text x={Math.max(20, last.x - 20)} y={Math.max(10, last.y - 8)} fontSize="10" fill="currentColor" className="text-muted">
          {formatValue ? formatValue(last.value) : last.value}
        </text>
      )}
    </svg>
  );
}

export function BarList({
  data,
  formatValue,
}: {
  data: { label: string; value: number }[];
  formatValue?: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return <p className="text-sm text-muted">No data yet.</p>;
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label}>
          <div className="flex items-center justify-between text-sm">
            <span className="truncate font-medium">{d.label}</span>
            <span className="shrink-0 text-muted">{formatValue ? formatValue(d.value) : d.value}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand to-accent"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

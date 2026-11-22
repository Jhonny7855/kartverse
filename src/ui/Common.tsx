import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { KartStats } from '../data/types';
import { clamp } from '../game/utils';

export type IconName =
  | 'play'
  | 'garage'
  | 'track'
  | 'modes'
  | 'career'
  | 'trophy'
  | 'settings'
  | 'credits'
  | 'flag'
  | 'speed'
  | 'bolt'
  | 'drift'
  | 'close'
  | 'pause'
  | 'arrow'
  | 'check'
  | 'lock'
  | 'chevron'
  | 'sound'
  | 'camera'
  | 'refresh'
  | 'home'
  | 'star'
  | 'clock';

const ICON_PATHS: Record<IconName, string> = {
  play: 'M8 5v14l11-7z',
  garage: 'M3 21V9l9-5 9 5v12M7 21v-7h10v7M6 9h12',
  track: 'M4 18c0-4 4-5 8-5s8-1 8-5M4 6c0 4 4 5 8 5s8 1 8 5',
  modes: 'M4 6h6v6H4zM14 6h6v6h-6zM4 16h6v4H4zM14 16h6v4h-6z',
  career: 'M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8z',
  trophy: 'M8 4h8v4a4 4 0 01-8 0V4zM8 6H5v2a3 3 0 003 3M16 6h3v2a3 3 0 01-3 3M10 16h4M9 20h6M12 12v4',
  settings:
    'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-2.9 1.2V21a2 2 0 11-4 0v-.09a1.7 1.7 0 00-2.9-1.2l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.7 1.7 0 004.6 15H4.5a2 2 0 110-4h.09a1.7 1.7 0 001.2-2.9l-.06-.06a2 2 0 112.83-2.83l.06.06A1.7 1.7 0 0011 4.6V4.5a2 2 0 114 0v.09a1.7 1.7 0 002.9 1.2l.06-.06a2 2 0 112.83 2.83l-.06.06A1.7 1.7 0 0019.4 11h.1a2 2 0 110 4h-.1z',
  credits: 'M12 3l9 4.5-9 4.5-9-4.5zM3 12l9 4.5 9-4.5M3 16.5L12 21l9-4.5',
  flag: 'M5 21V4M5 4h11l-1.5 3L16 10H5',
  speed: 'M12 20a8 8 0 110-16 8 8 0 010 16zM12 12l4-4M8 16h8',
  bolt: 'M13 2L4 14h6l-1 8 9-12h-6z',
  drift: 'M3 17c3 0 4-6 7-6s4 6 7 6M3 7h4M17 7h4',
  close: 'M6 6l12 12M18 6L6 18',
  pause: 'M8 5v14M16 5v14',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  check: 'M4 12l5 5L20 6',
  lock: 'M6 11V8a6 6 0 1112 0v3M5 11h14v10H5z',
  chevron: 'M9 6l6 6-6 6',
  sound: 'M4 9v6h3l5 4V5L7 9H4zM16 9a4 4 0 010 6M19 6a8 8 0 010 12',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 16a3.5 3.5 0 100-7 3.5 3.5 0 000 7z',
  refresh: 'M20 12a8 8 0 10-2.6 5.9M20 5v6h-6',
  home: 'M4 11l8-7 8 7v10h-5v-6H9v6H4z',
  star: 'M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8z',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
};

export function Icon({ name, size = 20, className = '' }: { name: IconName; size?: number; className?: string }) {
  const path = ICON_PATHS[name];
  const filled = name === 'play' || name === 'star' || name === 'bolt';
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

export function Panel({
  children,
  className = '',
  title,
  eyebrow,
  actions,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <header className="panel-head">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            {title && <h2 className="panel-title">{title}</h2>}
          </div>
          {actions && <div className="panel-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Slider({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
  format,
  hint,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  hint?: string;
}) {
  return (
    <label className="control-row">
      <div className="control-label">
        <span>{label}</span>
        <span className="control-value">{format ? format(value) : Math.round(value * 100)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range"
        style={{ ['--fill' as string]: `${((value - min) / (max - min)) * 100}%` }}
      />
      {hint && <span className="control-hint">{hint}</span>}
    </label>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="control-row toggle-row">
      <div>
        <span className="control-label-text">{label}</span>
        {hint && <span className="control-hint">{hint}</span>}
      </div>
      <button
        type="button"
        className={`toggle ${checked ? 'is-on' : ''}`}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-knob" />
      </button>
    </label>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div className="segmented-wrap">
      {label && <span className="control-label-text">{label}</span>}
      <div className="segmented" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`segmented-item ${value === o.value ? 'is-active' : ''}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function StatBars({ stats, compact = false }: { stats: KartStats; compact?: boolean }) {
  const rows: { label: string; value: number }[] = [
    { label: 'Top Speed', value: stats.topSpeed },
    { label: 'Acceleration', value: stats.acceleration },
    { label: 'Handling', value: stats.handling },
    { label: 'Drift', value: stats.drift },
    { label: 'Weight', value: stats.weight },
    { label: 'Boost', value: stats.boost },
  ];
  return (
    <div className={`stat-bars ${compact ? 'is-compact' : ''}`}>
      {rows.map((row) => (
        <div className="stat-bar" key={row.label}>
          <span className="stat-name">{row.label}</span>
          <span className="stat-track">
            <span
              className="stat-fill"
              style={{ width: `${clamp(row.value / 10, 0, 1) * 100}%`, animationDelay: `${row.value * 12}ms` }}
            />
          </span>
          <span className="stat-num">{row.value.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

export function TrackPreview({
  points,
  accent,
  className = '',
  showStart = true,
}: {
  points: { x: number; z: number }[];
  accent: string;
  className?: string;
  showStart?: boolean;
}) {
  const W = 200;
  const H = 120;
  const pad = 14;
  if (points.length < 2) return <svg className={className} viewBox={`0 0 ${W} ${H}`} />;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  const spanX = Math.max(1, maxX - minX);
  const spanZ = Math.max(1, maxZ - minZ);
  const scale = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanZ);
  const ox = (W - spanX * scale) / 2;
  const oy = (H - spanZ * scale) / 2;
  const project = (p: { x: number; z: number }) => ({
    x: ox + (p.x - minX) * scale,
    y: oy + (p.z - minZ) * scale,
  });
  const path = points
    .map((p, i) => {
      const q = project(p);
      return `${i === 0 ? 'M' : 'L'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
    })
    .join(' ');
  const start = project(points[0]);
  return (
    <svg className={`track-preview ${className}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Track layout">
      <path d={path} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="9" strokeLinejoin="round" strokeLinecap="round" />
      <path d={path} fill="none" stroke={accent} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" opacity="0.92" />
      {showStart && <circle cx={start.x} cy={start.y} r="3.4" fill="#fff" stroke={accent} strokeWidth="1.6" />}
    </svg>
  );
}

export function ProgressRing({
  value,
  size = 44,
  stroke = 4,
  color = 'var(--accent)',
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = clamp(value, 0, 1) * c;
  return (
    <span className="progress-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${filled} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="progress-ring-content">{children}</span>
    </span>
  );
}

export interface ToastItem {
  id: number;
  text: string;
  kind: 'info' | 'warn' | 'success';
}

export function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const push = (text: string, kind: 'info' | 'warn' | 'success' = 'info') => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev.slice(-3), { id, text, kind }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2600);
  };
  return { toasts, push };
}

export function useRafTime(active = true) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      setT(performance.now() - start);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return t;
}

export function Logo({ size = 'lg' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`logo logo-${size}`} aria-label="Kartverse">
      <span className="logo-kart">KART</span>
      <span className="logo-verse">VERSE</span>
    </span>
  );
}

import type { Customization, KartDef } from '../data/types';

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

export const smoothstep = (t: number) => t * t * (3 - 2 * t);

export const wrapAngle = (a: number) => {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
};

export const angleDelta = (from: number, to: number) => wrapAngle(to - from);

export const TAU = Math.PI * 2;

export function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function formatTime(seconds: number | null | undefined, showMs = true): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '--:--';
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  const ms = Math.floor((safe % 1) * 1000);
  if (!showMs) return `${m}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

export function formatGap(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  if (seconds <= 0) return 'LEADER';
  return `+${seconds.toFixed(2)}s`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export const defaultCustomization = (kart: KartDef): Customization => ({
  bodyColor: kart.bodyColor,
  wheelColor: '#14161c',
  rimColor: kart.accentColor,
  glowColor: kart.accentColor,
  decal: 'stripe',
  number: '07',
  helmetColor: kart.accentColor,
  spoiler: kart.spoiler,
  exhaust: kart.exhaust,
});

export const KART_CLASS_NAMES: Record<string, string> = {
  speedster: 'Velocity Class',
  balanced: 'All-Rounder',
  drifter: 'Slide Class',
  heavy: 'Bulwark Class',
  rocket: 'Ignition Class',
  tech: 'Vector Class',
};

export const MODE_LABELS: Record<string, string> = {
  quick: 'Quick Race',
  grandprix: 'Grand Prix',
  timetrial: 'Time Trial',
  practice: 'Practice',
  elimination: 'Elimination',
};

export const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
  pro: 'Pro',
};

export const RACER_NAMES = [
  'NOVA', 'APEX', 'HEX', 'SABLE', 'RIFT', 'ZEN', 'VOLT', 'MIRAGE',
  'HALO', 'KRONOS', 'FLUX', 'ONYX', 'RAZE', 'CIPHER', 'VANTA',
];

export function clampColor(hex: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#ff6b1a';
}

/**
 * Best guess at the player's device, used once to seed the Play Mode setting.
 * A coarse primary pointer or a touch-capable screen means phone/tablet.
 */
export function detectPlayMode(): 'desktop' | 'mobile' {
  try {
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
    const touch = 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;
    return coarse || touch ? 'mobile' : 'desktop';
  } catch {
    return 'desktop';
  }
}

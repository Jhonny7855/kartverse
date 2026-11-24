import type {
  Customization,
  Difficulty,
  KartClassId,
  LapRecord,
  Profile,
  SaveData,
  Settings,
} from '../data/types';
import { KARTS, getKart } from '../data/karts';
import { TRACKS } from '../data/tracks';
import { clampColor, defaultCustomization, detectPlayMode } from './utils';

const STORAGE_KEY = 'kartverse.save.v2';
const SAVE_VERSION = 2;

export const DEFAULT_SETTINGS: Settings = {
  playMode: detectPlayMode(),
  quality: 'high',
  resolutionScale: 1,
  shadows: true,
  antiAliasing: true,
  effects: true,
  particles: true,
  motionIntensity: 0.7,
  masterVolume: 0.75,
  musicVolume: 0.32,
  sfxVolume: 0.8,
  muted: false,
  difficulty: 'normal',
  laps: 3,
  steeringSensitivity: 1,
  cameraSensitivity: 1,
  cameraShake: 0.5,
  units: 'kmh',
  bindings: {
    accelerate: 'KeyW',
    brake: 'KeyS',
    left: 'KeyA',
    right: 'KeyD',
    drift: 'Space',
    boost: 'ShiftLeft',
    item: 'KeyF',
    reset: 'KeyR',
    camera: 'KeyC',
    pause: 'Escape',
  },
  colorblind: false,
  reducedMotion: false,
  uiScale: 1,
  highContrast: false,
  subtitles: true,
  musicEnabled: true,
};

const defaultProfile = (): Profile => ({
  name: 'PLAYER ONE',
  xp: 0,
  level: 1,
  credits: 800,
  races: 0,
  wins: 0,
  podiums: 0,
  distance: 0,
  bestLap: null,
  driftScore: 0,
  topSpeed: 0,
  coins: 0,
  unlockedKarts: ['speedster', 'balanced', 'drifter', 'heavy'],
  achievements: {},
  history: [],
  tracksPlayed: [],
  cleanRaces: 0,
  boostUses: 0,
  customizationMaster: false,
});

export function defaultCustomizations(): Record<string, Customization> {
  const out: Record<string, Customization> = {};
  for (const kart of KARTS) out[kart.id] = defaultCustomization(kart);
  return out;
}

export function createDefaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    profile: defaultProfile(),
    settings: { ...DEFAULT_SETTINGS, bindings: { ...DEFAULT_SETTINGS.bindings } },
    karts: defaultCustomizations(),
    records: {},
    raceRecords: {},
    ghosts: {},
    grandPrix: null,
    lastSelection: {
      trackId: TRACKS[0].id,
      kartId: 'balanced',
      difficulty: 'normal',
      laps: 3,
      opponents: 5,
    },
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function mergeCustomization(raw: unknown, fallback: Customization): Customization {
  if (!isObject(raw)) return fallback;
  return {
    bodyColor: clampColor(String(raw.bodyColor ?? fallback.bodyColor)),
    wheelColor: clampColor(String(raw.wheelColor ?? fallback.wheelColor)),
    rimColor: clampColor(String(raw.rimColor ?? fallback.rimColor)),
    glowColor: clampColor(String(raw.glowColor ?? fallback.glowColor)),
    decal: (['none', 'stripe', 'flames', 'circuit', 'star'] as const).includes(raw.decal as never)
      ? (raw.decal as Customization['decal'])
      : fallback.decal,
    number: String(raw.number ?? fallback.number).slice(0, 3).replace(/[^0-9]/g, '') || fallback.number,
    helmetColor: clampColor(String(raw.helmetColor ?? fallback.helmetColor)),
    spoiler: (['low', 'mid', 'high', 'wing'] as const).includes(raw.spoiler as never)
      ? (raw.spoiler as Customization['spoiler'])
      : fallback.spoiler,
    exhaust: (['single', 'dual', 'jet'] as const).includes(raw.exhaust as never)
      ? (raw.exhaust as Customization['exhaust'])
      : fallback.exhaust,
  };
}

function sanitizeBoolean(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function sanitizeNumber(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, n));
}

export function sanitizeSave(raw: unknown): SaveData {
  const base = createDefaultSave();
  if (!isObject(raw)) return base;

  const rawProfile = isObject(raw.profile) ? raw.profile : {};
  const profile: Profile = {
    ...base.profile,
    name: typeof rawProfile.name === 'string' && rawProfile.name.trim() ? rawProfile.name.slice(0, 18) : base.profile.name,
    xp: sanitizeNumber(rawProfile.xp, 0, 0, 1e9),
    level: sanitizeNumber(rawProfile.level, 1, 1, 999),
    credits: sanitizeNumber(rawProfile.credits, base.profile.credits, 0, 1e9),
    races: sanitizeNumber(rawProfile.races, 0, 0, 1e6),
    wins: sanitizeNumber(rawProfile.wins, 0, 0, 1e6),
    podiums: sanitizeNumber(rawProfile.podiums, 0, 0, 1e6),
    distance: sanitizeNumber(rawProfile.distance, 0, 0, 1e9),
    bestLap: typeof rawProfile.bestLap === 'number' && rawProfile.bestLap > 0 ? rawProfile.bestLap : null,
    driftScore: sanitizeNumber(rawProfile.driftScore, 0, 0, 1e9),
    topSpeed: sanitizeNumber(rawProfile.topSpeed, 0, 0, 1000),
    coins: sanitizeNumber(rawProfile.coins, 0, 0, 1e9),
    unlockedKarts: Array.isArray(rawProfile.unlockedKarts)
      ? (Array.from(new Set([...base.profile.unlockedKarts, ...rawProfile.unlockedKarts.filter((k): k is KartClassId => typeof k === 'string' && KARTS.some((kd) => kd.id === k))])) as KartClassId[])
      : base.profile.unlockedKarts,
    achievements: isObject(rawProfile.achievements)
      ? (Object.fromEntries(
          Object.entries(rawProfile.achievements).filter(
            ([, v]) => typeof v === 'number' && Number.isFinite(v),
          ),
        ) as Record<string, number>)
      : {},
    history: Array.isArray(rawProfile.history)
      ? rawProfile.history
          .filter((h): h is Record<string, unknown> => isObject(h))
          .slice(-100)
          .map((h) => ({
            trackId: String(h.trackId ?? TRACKS[0].id),
            trackName: String(h.trackName ?? 'Unknown'),
            mode: (['quick', 'grandprix', 'timetrial', 'practice', 'elimination'] as const).includes(h.mode as never)
              ? (h.mode as Profile['history'][number]['mode'])
              : 'quick',
            position: sanitizeNumber(h.position, 1, 1, 99),
            totalRacers: sanitizeNumber(h.totalRacers, 1, 1, 99),
            totalTime: sanitizeNumber(h.totalTime, 0, 0, 1e6),
            bestLap: typeof h.bestLap === 'number' ? h.bestLap : null,
            date: sanitizeNumber(h.date, Date.now(), 0, 1e15),
          }))
      : [],
    tracksPlayed: Array.isArray(rawProfile.tracksPlayed)
      ? rawProfile.tracksPlayed.filter((t): t is string => typeof t === 'string' && TRACKS.some((tr) => tr.id === t))
      : [],
    cleanRaces: sanitizeNumber(rawProfile.cleanRaces, 0, 0, 1e6),
    boostUses: sanitizeNumber(rawProfile.boostUses, 0, 0, 1e9),
    customizationMaster: sanitizeBoolean(rawProfile.customizationMaster, false),
  };

  const rawSettings = isObject(raw.settings) ? raw.settings : {};
  const rawBindings = isObject(rawSettings.bindings) ? rawSettings.bindings : {};
  const settings: Settings = {
    ...base.settings,
    playMode: rawSettings.playMode === 'mobile' || rawSettings.playMode === 'desktop'
      ? (rawSettings.playMode as Settings['playMode'])
      : base.settings.playMode,
    quality: (['low', 'medium', 'high'] as const).includes(rawSettings.quality as never)
      ? (rawSettings.quality as Settings['quality'])
      : base.settings.quality,
    resolutionScale: sanitizeNumber(rawSettings.resolutionScale, 1, 0.5, 1),
    shadows: sanitizeBoolean(rawSettings.shadows, true),
    antiAliasing: sanitizeBoolean(rawSettings.antiAliasing, true),
    effects: sanitizeBoolean(rawSettings.effects, true),
    particles: sanitizeBoolean(rawSettings.particles, true),
    motionIntensity: sanitizeNumber(rawSettings.motionIntensity, 0.7, 0, 1),
    masterVolume: sanitizeNumber(rawSettings.masterVolume, 0.75, 0, 1),
    musicVolume: sanitizeNumber(rawSettings.musicVolume, 0.32, 0, 1),
    sfxVolume: sanitizeNumber(rawSettings.sfxVolume, 0.8, 0, 1),
    muted: sanitizeBoolean(rawSettings.muted, false),
    difficulty: (['easy', 'normal', 'hard', 'pro'] as const).includes(rawSettings.difficulty as never)
      ? (rawSettings.difficulty as Difficulty)
      : base.settings.difficulty,
    laps: sanitizeNumber(rawSettings.laps, 3, 1, 9),
    steeringSensitivity: sanitizeNumber(rawSettings.steeringSensitivity, 1, 0.4, 2),
    cameraSensitivity: sanitizeNumber(rawSettings.cameraSensitivity, 1, 0.4, 2),
    cameraShake: sanitizeNumber(rawSettings.cameraShake, 0.5, 0, 1),
    units: rawSettings.units === 'mph' ? 'mph' : 'kmh',
    bindings: { ...base.settings.bindings, ...Object.fromEntries(Object.entries(rawBindings).filter(([, v]) => typeof v === 'string')) },
    colorblind: sanitizeBoolean(rawSettings.colorblind, false),
    reducedMotion: sanitizeBoolean(rawSettings.reducedMotion, false),
    uiScale: sanitizeNumber(rawSettings.uiScale, 1, 0.8, 1.3),
    highContrast: sanitizeBoolean(rawSettings.highContrast, false),
    subtitles: sanitizeBoolean(rawSettings.subtitles, true),
    musicEnabled: sanitizeBoolean(rawSettings.musicEnabled, true),
  };

  const karts = defaultCustomizations();
  if (isObject(raw.karts)) {
    for (const kart of KARTS) karts[kart.id] = mergeCustomization(raw.karts[kart.id], defaultCustomization(kart));
  }

  const sanitizeRecordMap = (v: unknown): Record<string, SaveData['records'][string]> => {
    if (!isObject(v)) return {};
    const out: Record<string, SaveData['records'][string]> = {};
    for (const [key, list] of Object.entries(v)) {
      if (!Array.isArray(list)) continue;
      const clean = list
        .filter((r): r is Record<string, unknown> => isObject(r) && typeof r.time === 'number' && r.time > 0)
        .slice(0, 20)
        .map((r) => ({
          time: r.time as number,
          kartId: getKart((typeof r.kartId === 'string' ? r.kartId : 'balanced') as KartClassId).id,
          mode: (typeof r.mode === 'string' ? r.mode : 'quick') as LapRecord['mode'],
          date: sanitizeNumber(r.date, Date.now(), 0, 1e15),
        }));
      if (clean.length) out[key] = clean;
    }
    return out;
  };

  const rawGp = isObject(raw.grandPrix) ? raw.grandPrix : null;
  const grandPrix = rawGp
    ? {
        trackIds: Array.isArray(rawGp.trackIds)
          ? rawGp.trackIds.filter((t): t is string => typeof t === 'string' && TRACKS.some((tr) => tr.id === t))
          : [],
        round: sanitizeNumber(rawGp.round, 0, 0, 20),
        standings: Array.isArray(rawGp.standings)
          ? rawGp.standings
              .filter((s): s is Record<string, unknown> => isObject(s))
              .map((s) => ({
                name: String(s.name ?? 'RACER'),
                points: sanitizeNumber(s.points, 0, 0, 999),
                isPlayer: Boolean(s.isPlayer),
              }))
          : [],
        finished: sanitizeBoolean(rawGp.finished, false),
        date: sanitizeNumber(rawGp.date, Date.now(), 0, 1e15),
      }
    : null;

  const rawLast = isObject(raw.lastSelection) ? raw.lastSelection : {};
  return {
    version: SAVE_VERSION,
    profile,
    settings,
    karts,
    records: sanitizeRecordMap(raw.records),
    raceRecords: sanitizeRecordMap(raw.raceRecords),
    ghosts: isObject(raw.ghosts) ? (raw.ghosts as SaveData['ghosts']) : {},
    grandPrix,
    lastSelection: {
      trackId: TRACKS.some((t) => t.id === rawLast.trackId) ? String(rawLast.trackId) : TRACKS[0].id,
      kartId: KARTS.some((k) => k.id === rawLast.kartId) ? (rawLast.kartId as KartClassId) : 'balanced',
      difficulty: (['easy', 'normal', 'hard', 'pro'] as const).includes(rawLast.difficulty as never)
        ? (rawLast.difficulty as Difficulty)
        : 'normal',
      laps: sanitizeNumber(rawLast.laps, 3, 1, 9),
      opponents: sanitizeNumber(rawLast.opponents, 5, 1, 7),
    },
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('kartverse.save.v1');
    if (!raw) return createDefaultSave();
    return sanitizeSave(JSON.parse(raw));
  } catch {
    return createDefaultSave();
  }
}

export function persistSave(save: SaveData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be unavailable in private mode; the session continues in memory.
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('kartverse.save.v1');
  } catch {
    // ignore
  }
}

export function exportSave(save: SaveData): string {
  return JSON.stringify(save, null, 2);
}

export function importSave(text: string): SaveData | null {
  try {
    const parsed = JSON.parse(text);
    if (!isObject(parsed) || typeof parsed.version !== 'number') return null;
    return sanitizeSave(parsed);
  } catch {
    return null;
  }
}

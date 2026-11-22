export type GameMode = 'quick' | 'grandprix' | 'timetrial' | 'practice' | 'elimination';

export type Difficulty = 'easy' | 'normal' | 'hard' | 'pro';

export type KartClassId = 'speedster' | 'balanced' | 'drifter' | 'heavy' | 'rocket' | 'tech';

export type ThemeId = 'city' | 'coast' | 'forest' | 'volcano' | 'skyline' | 'desert';

export type DecalId = 'none' | 'stripe' | 'flames' | 'circuit' | 'star';
export type SpoilerId = 'low' | 'mid' | 'high' | 'wing';
export type ExhaustId = 'single' | 'dual' | 'jet';

export interface KartStats {
  topSpeed: number;
  acceleration: number;
  handling: number;
  drift: number;
  weight: number;
  boost: number;
}

export interface KartDef {
  id: KartClassId;
  name: string;
  className: string;
  tagline: string;
  description: string;
  stats: KartStats;
  bodyColor: string;
  accentColor: string;
  price: number;
  wheelSize: number;
  wheelWidth: number;
  chassisScale: [number, number, number];
  spoiler: SpoilerId;
  exhaust: ExhaustId;
}

export interface TrackPoint {
  x: number;
  y: number;
  z: number;
}

export interface TrackPalette {
  skyTop: string;
  skyBottom: string;
  fog: string;
  ground: string;
  road: string;
  accent: string;
  secondary: string;
  ambient: string;
  sun: string;
  sunIntensity: number;
  ambientIntensity: number;
}

export interface TrackDef {
  id: string;
  name: string;
  tagline: string;
  description: string;
  theme: ThemeId;
  points: TrackPoint[];
  width: number;
  laps: number;
  difficulty: 1 | 2 | 3;
  palette: TrackPalette;
  checkpointCount: number;
  boostPads: number[];
  jumpPads: number[];
}

export interface Customization {
  bodyColor: string;
  wheelColor: string;
  rimColor: string;
  glowColor: string;
  decal: DecalId;
  number: string;
  helmetColor: string;
  spoiler: SpoilerId;
  exhaust: ExhaustId;
}

export interface RaceConfig {
  mode: GameMode;
  trackId: string;
  kartId: KartClassId;
  customization: Customization;
  difficulty: Difficulty;
  opponents: number;
  laps: number;
  units: 'kmh' | 'mph';
}

export interface RacerStanding {
  name: string;
  isPlayer: boolean;
  kartId: KartClassId;
  position: number;
  completed: boolean;
  eliminated: boolean;
  totalTime: number | null;
  bestLap: number | null;
  gap: string;
  progress: number;
}

export interface RaceOutcome {
  mode: GameMode;
  trackId: string;
  trackName: string;
  difficulty: Difficulty;
  laps: number;
  position: number;
  totalRacers: number;
  totalTime: number;
  bestLap: number | null;
  topSpeed: number;
  driftScore: number;
  cleanRace: boolean;
  boostUses: number;
  eliminated: boolean;
  standings: RacerStanding[];
  raceDate: number;
  ghost?: GhostData;
}

export interface HudSnapshot {
  mode: GameMode;
  trackName: string;
  state: 'loading' | 'countdown' | 'racing' | 'paused' | 'finished';
  countdown: number;
  speed: number;
  speedLimit: number;
  speedUnit: 'kmh' | 'mph';
  gear: number;
  rpm: number;
  position: number;
  totalRacers: number;
  lap: number;
  totalLaps: number;
  raceTime: number;
  currentLapTime: number;
  bestLap: number | null;
  lastLap: number | null;
  boost: number;
  drift: number;
  drifting: boolean;
  boosting: boolean;
  offRoad: boolean;
  wrongWay: boolean;
  item: string | null;
  shieldTime: number;
  cameraMode: string;
  eliminationIn: number | null;
  playerProgress: number;
  mapTrack: { x: number; z: number }[];
  mapRacers: { x: number; z: number; isPlayer: boolean; eliminated: boolean }[];
  mapCheckpoints: { x: number; z: number }[];
  mapStart: { x: number; z: number };
  mapHeading: number;
}

export type QualityLevel = 'low' | 'medium' | 'high';

export interface Settings {
  quality: QualityLevel;
  resolutionScale: number;
  shadows: boolean;
  antiAliasing: boolean;
  effects: boolean;
  particles: boolean;
  motionIntensity: number;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  difficulty: Difficulty;
  laps: number;
  steeringSensitivity: number;
  cameraSensitivity: number;
  cameraShake: number;
  units: 'kmh' | 'mph';
  bindings: KeyBindings;
  colorblind: boolean;
  reducedMotion: boolean;
  uiScale: number;
  highContrast: boolean;
  subtitles: boolean;
  musicEnabled: boolean;
}

export interface KeyBindings {
  accelerate: string;
  brake: string;
  left: string;
  right: string;
  drift: string;
  boost: string;
  item: string;
  reset: string;
  camera: string;
  pause: string;
}

export interface RaceHistoryEntry {
  trackId: string;
  trackName: string;
  mode: GameMode;
  position: number;
  totalRacers: number;
  totalTime: number;
  bestLap: number | null;
  date: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  category: 'racing' | 'drifting' | 'speed' | 'exploration' | 'collector';
  reward: number;
  xp: number;
}

export interface Profile {
  name: string;
  xp: number;
  level: number;
  credits: number;
  races: number;
  wins: number;
  podiums: number;
  distance: number;
  bestLap: number | null;
  driftScore: number;
  topSpeed: number;
  unlockedKarts: KartClassId[];
  achievements: Record<string, number>;
  history: RaceHistoryEntry[];
  tracksPlayed: string[];
  cleanRaces: number;
  boostUses: number;
  customizationMaster: boolean;
}

export interface LapRecord {
  time: number;
  kartId: KartClassId;
  mode: GameMode;
  date: number;
}

export interface GhostFrame {
  t: number;
  x: number;
  z: number;
  y: number;
  heading: number;
}

export interface GhostData {
  time: number;
  frames: GhostFrame[];
  kartId: KartClassId;
  date: number;
}

export interface GrandPrixState {
  trackIds: string[];
  round: number;
  standings: { name: string; points: number; isPlayer: boolean }[];
  finished: boolean;
  date: number;
}

export interface SaveData {
  version: number;
  profile: Profile;
  settings: Settings;
  karts: Record<string, Customization>;
  records: Record<string, LapRecord[]>;
  raceRecords: Record<string, LapRecord[]>;
  ghosts: Record<string, GhostData>;
  grandPrix: GrandPrixState | null;
  lastSelection: {
    trackId: string;
    kartId: KartClassId;
    difficulty: Difficulty;
    laps: number;
    opponents: number;
  };
}

export interface AchievementUnlock {
  def: AchievementDef;
  reward: number;
  xp: number;
}

export interface RaceRewards {
  xp: number;
  credits: number;
  levelUp: boolean;
  newLevel: number;
  achievements: AchievementUnlock[];
  newBestLap: boolean;
  newBestRace: boolean;
}

export interface TouchInput {
  steer: number;
  throttle: number;
  brake: number;
  drift: boolean;
  boost: boolean;
}

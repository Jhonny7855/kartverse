import type { ThemeId, TrackDef, TrackPalette, TrackPoint } from './types';

const palettes: Record<ThemeId, TrackPalette> = {
  city: {
    skyTop: '#1e2547',
    skyBottom: '#4c357f',
    fog: '#241e42',
    ground: '#171a28',
    road: '#464b63',
    accent: '#22e6ff',
    secondary: '#b14cff',
    ambient: '#b6c6ff',
    sun: '#dff0ff',
    sunIntensity: 2.6,
    ambientIntensity: 1.35,
  },
  coast: {
    skyTop: '#1c2a63',
    skyBottom: '#ff9a62',
    fog: '#e8a27a',
    ground: '#d6bb86',
    road: '#2b2c35',
    accent: '#ffb347',
    secondary: '#ff5e7d',
    ambient: '#ffd7b0',
    sun: '#ffd9a0',
    sunIntensity: 2.4,
    ambientIntensity: 0.8,
  },
  forest: {
    skyTop: '#6ea8d8',
    skyBottom: '#d5e8cb',
    fog: '#a9c4a1',
    ground: '#45683a',
    road: '#25272b',
    accent: '#8dff6a',
    secondary: '#ffd166',
    ambient: '#d7efd0',
    sun: '#fff2cf',
    sunIntensity: 2.0,
    ambientIntensity: 0.85,
  },
  volcano: {
    skyTop: '#1c0a10',
    skyBottom: '#8a2a18',
    fog: '#5a1d14',
    ground: '#3a2620',
    road: '#2c282e',
    accent: '#ff5a1f',
    secondary: '#ffcf5a',
    ambient: '#ffa077',
    sun: '#ffb074',
    sunIntensity: 2.1,
    ambientIntensity: 0.9,
  },
  skyline: {
    skyTop: '#06152f',
    skyBottom: '#59c8ff',
    fog: '#7bc8ee',
    ground: '#0a1224',
    road: '#2d3140',
    accent: '#47e6ff',
    secondary: '#ffd166',
    ambient: '#bfeaff',
    sun: '#ffffff',
    sunIntensity: 2.2,
    ambientIntensity: 0.9,
  },
  desert: {
    skyTop: '#2b3b66',
    skyBottom: '#ffd29a',
    fog: '#d8b080',
    ground: '#cfa76c',
    road: '#4a4340',
    accent: '#ffd166',
    secondary: '#ff7a45',
    ambient: '#ffe6c2',
    sun: '#ffe0b0',
    sunIntensity: 2.6,
    ambientIntensity: 0.75,
  },
};

type Pt = readonly [number, number];

function circuit(points: Pt[], height?: (index: number, x: number, z: number) => number): TrackPoint[] {
  return points.map(([x, z], i) => ({ x, z, y: height ? height(i, x, z) : 0 }));
}

/** Long straights, a square-ish outer loop and a tight chicane complex. */
const NEON_CITY: Pt[] = [
  [-170, -90], [-60, -110], [10, -96], [90, -112], [170, -88], [196, -20],
  [170, 40], [186, 96], [120, 120], [40, 100], [-30, 118], [-110, 104],
  [-178, 118], [-200, 40], [-172, -24],
];

/** Wide, flowing coastal sweepers with one very long loaded corner. */
const SUNSET_COAST: Pt[] = [
  [-210, -60], [-150, -120], [-40, -140], [70, -130], [160, -96], [206, -20],
  [200, 60], [150, 118], [60, 140], [-40, 132], [-130, 100], [-196, 40],
];

/** Tight, technical karting loop full of direction changes. */
const FOREST_RUSH: Pt[] = [
  [-150, -80], [-90, -120], [-30, -100], [0, -140], [60, -120], [100, -70],
  [70, -20], [110, 20], [80, 70], [20, 60], [-20, 100], [-80, 80],
  [-100, 20], [-150, 10], [-130, -40],
];

/** Angular caldera loop with a long climb and a fast blind crest. */
const VOLCANO_CIRCUIT: Pt[] = [
  [0, -180], [90, -120], [160, -40], [130, 40], [160, 110], [80, 150],
  [0, 120], [-80, 150], [-150, 100], [-130, 20], [-170, -50], [-100, -130],
];

/** Elevated championship layout with a tight final complex. */
const SKYLINE_GP: Pt[] = [
  [-200, -20], [-170, -100], [-90, -140], [20, -150], [130, -130], [200, -60],
  [190, 30], [120, 80], [40, 70], [-30, 110], [-110, 120], [-190, 80], [-215, 10],
];

/** Huge fast sweepers with a narrow canyon pinch. */
const DESERT_STORM: Pt[] = [
  [-190, -70], [-120, -130], [-20, -140], [90, -120], [180, -60], [200, 20],
  [150, 80], [70, 70], [0, 100], [-80, 130], [-160, 100], [-205, 30],
];

export const TRACKS: TrackDef[] = [
  {
    id: 'neon-city',
    name: 'Neon City',
    tagline: 'Midnight · Wet asphalt · No limits',
    description:
      'A canyon of glass and neon. Two long straights between skyscrapers feed a technical mid-sector of tight chicanes and a floodlit tunnel.',
    theme: 'city',
    points: circuit(NEON_CITY, (i) => (i > 5 && i < 9 ? 1.4 : 0)),
    width: 12.5,
    laps: 3,
    difficulty: 2,
    palette: palettes.city,
    checkpointCount: 20,
    boostPads: [0.13, 0.47, 0.79],
    jumpPads: [0.61],
  },
  {
    id: 'sunset-coast',
    name: 'Sunset Coast',
    tagline: 'Golden hour · Ocean air · Wide open',
    description:
      'A high-speed coastal sweep above the Pacific. Long flowing corners reward momentum and brave throttle control.',
    theme: 'coast',
    points: circuit(SUNSET_COAST, (i) => Math.sin(i * 0.9) * 1.6),
    width: 13,
    laps: 3,
    difficulty: 1,
    palette: palettes.coast,
    checkpointCount: 18,
    boostPads: [0.18, 0.56, 0.87],
    jumpPads: [0.34],
  },
  {
    id: 'forest-rush',
    name: 'Forest Rush',
    tagline: 'Ancient pines · Cool air · Tight lines',
    description:
      'Carved through a living forest, this ribbon of asphalt demands precision. Blind crests, wooden bridges, and relentless direction changes.',
    theme: 'forest',
    points: circuit(FOREST_RUSH, (i) => Math.sin(i * 1.15) * 2.1 + Math.cos(i * 0.5) * 1.2),
    width: 11,
    laps: 3,
    difficulty: 3,
    palette: palettes.forest,
    checkpointCount: 22,
    boostPads: [0.1, 0.4, 0.72],
    jumpPads: [0.55],
  },
  {
    id: 'volcano-circuit',
    name: 'Volcano Circuit',
    tagline: 'Ashfall · Lava glow · Zero margin',
    description:
      'A brutal caldera loop cut into black basalt. The air shimmers, the barriers glow, and a long climb punishes every mistake.',
    theme: 'volcano',
    points: circuit(VOLCANO_CIRCUIT, (i) => Math.sin(i * 0.85 + 0.6) * 4.0),
    width: 11.5,
    laps: 3,
    difficulty: 3,
    palette: palettes.volcano,
    checkpointCount: 20,
    boostPads: [0.2, 0.52, 0.83],
    jumpPads: [0.68],
  },
  {
    id: 'skyline-gp',
    name: 'Skyline GP',
    tagline: 'Elevated · Vertical · Fearless',
    description:
      'A floating championship circuit suspended above the clouds. Elevation changes, blind sky bridges, and a terrifying final drop.',
    theme: 'skyline',
    points: circuit(SKYLINE_GP, (i) => 14 + Math.sin(i * 0.8 + 1.1) * 6.5),
    width: 11,
    laps: 3,
    difficulty: 3,
    palette: palettes.skyline,
    checkpointCount: 20,
    boostPads: [0.15, 0.45, 0.76],
    jumpPads: [0.63],
  },
  {
    id: 'desert-storm',
    name: 'Desert Storm',
    tagline: 'Canyon wind · Red rock · Full throttle',
    description:
      'A sun-bleached canyon circuit with enormous sweepers and a sandstorm closing in. Grip fades, nerves fray, speed remains.',
    theme: 'desert',
    points: circuit(DESERT_STORM, (i) => Math.sin(i * 0.75 + 2) * 2.4),
    width: 12.5,
    laps: 3,
    difficulty: 2,
    palette: palettes.desert,
    checkpointCount: 18,
    boostPads: [0.12, 0.43, 0.77],
    jumpPads: [0.58],
  },
];

export const TRACK_MAP = new Map(TRACKS.map((t) => [t.id, t]));

export function getTrack(id: string): TrackDef {
  return TRACK_MAP.get(id) ?? TRACKS[0];
}

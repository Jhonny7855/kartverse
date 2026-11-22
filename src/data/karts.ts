import type { KartClassId, KartDef } from './types';

export const KARTS: KartDef[] = [
  {
    id: 'speedster',
    name: 'Vortessa',
    className: 'Speedster',
    tagline: 'Built for the long straight.',
    description:
      'A needle-nosed missile with a screaming top end. Rewards commitment, punishes hesitation.',
    stats: { topSpeed: 9.3, acceleration: 5.4, handling: 4.5, drift: 5.2, weight: 4.1, boost: 8.2 },
    bodyColor: '#ff5a2e',
    accentColor: '#ffd166',
    price: 0,
    wheelSize: 0.62,
    wheelWidth: 0.42,
    chassisScale: [1.02, 0.92, 1.14],
    spoiler: 'high',
    exhaust: 'dual',
  },
  {
    id: 'balanced',
    name: 'Aurelia',
    className: 'Balanced',
    tagline: 'The reference point.',
    description:
      'Every system in harmony. The Aurelia is the kart you benchmark every other machine against.',
    stats: { topSpeed: 7.2, acceleration: 7.3, handling: 7.4, drift: 6.8, weight: 6.2, boost: 6.8 },
    bodyColor: '#28d4ff',
    accentColor: '#f3f7ff',
    price: 0,
    wheelSize: 0.58,
    wheelWidth: 0.45,
    chassisScale: [1.08, 1, 1.04],
    spoiler: 'mid',
    exhaust: 'single',
  },
  {
    id: 'drifter',
    name: 'Sable',
    className: 'Drifter',
    tagline: 'Sideways is faster.',
    description:
      'A rear-bias cornering machine. It generates boost from angle, turning every hairpin into a weapon.',
    stats: { topSpeed: 6.6, acceleration: 7.8, handling: 8.8, drift: 9.6, weight: 4.9, boost: 7.6 },
    bodyColor: '#ff2f8d',
    accentColor: '#ffd1e8',
    price: 0,
    wheelSize: 0.56,
    wheelWidth: 0.5,
    chassisScale: [1.12, 1.04, 1.0],
    spoiler: 'wing',
    exhaust: 'single',
  },
  {
    id: 'heavy',
    name: 'Bastion',
    className: 'Heavy',
    tagline: 'Nothing moves it.',
    description:
      'Reinforced frame, massive contact patch, absurd stability. It shrugs off contact and brakes late.',
    stats: { topSpeed: 6.8, acceleration: 5.0, handling: 5.6, drift: 4.2, weight: 9.6, boost: 5.2 },
    bodyColor: '#8d63ff',
    accentColor: '#c9ff4d',
    price: 0,
    wheelSize: 0.68,
    wheelWidth: 0.58,
    chassisScale: [1.24, 1.12, 0.98],
    spoiler: 'low',
    exhaust: 'dual',
  },
  {
    id: 'rocket',
    name: 'Kestrel X',
    className: 'Rocket',
    tagline: 'Instant. Violent. Alive.',
    description:
      'A launch specialist with a hyper-aggressive power curve. Tame the throttle and it is untouchable.',
    stats: { topSpeed: 8.2, acceleration: 9.8, handling: 5.8, drift: 5.0, weight: 3.8, boost: 9.4 },
    bodyColor: '#ffb703',
    accentColor: '#ff3d00',
    price: 1600,
    wheelSize: 0.6,
    wheelWidth: 0.46,
    chassisScale: [1.0, 0.96, 1.18],
    spoiler: 'wing',
    exhaust: 'jet',
  },
  {
    id: 'tech',
    name: 'Cipher GT',
    className: 'Tech',
    tagline: 'Grip is a technology.',
    description:
      'Active aero and a low centre of gravity. Carries more speed through corners than should be legal.',
    stats: { topSpeed: 7.0, acceleration: 7.6, handling: 9.7, drift: 7.9, weight: 5.8, boost: 7.2 },
    bodyColor: '#2fffb4',
    accentColor: '#0b2b26',
    price: 2200,
    wheelSize: 0.57,
    wheelWidth: 0.5,
    chassisScale: [1.1, 0.94, 1.02],
    spoiler: 'mid',
    exhaust: 'jet',
  },
];

export const KART_MAP = new Map<KartClassId, KartDef>(KARTS.map((k) => [k.id, k]));

export function getKart(id: KartClassId): KartDef {
  return KART_MAP.get(id) ?? KARTS[0];
}

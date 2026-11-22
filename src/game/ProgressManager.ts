import type {
  AchievementUnlock,
  Customization,
  GameMode,
  GhostData,
  LapRecord,
  Profile,
  RaceOutcome,
  RaceRewards,
  SaveData,
} from '../data/types';
import { ACHIEVEMENTS, ACHIEVEMENT_MAP } from '../data/achievements';
import { KARTS } from '../data/karts';
import { TRACKS } from '../data/tracks';
import { clamp, formatTime } from './utils';

export const XP_PER_LEVEL = 1200;

export function levelFromXp(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(xp / XP_PER_LEVEL) * 2) + 1);
}

export function xpForLevel(level: number): number {
  return Math.max(0, Math.pow((level - 1) / 2, 2) * XP_PER_LEVEL);
}

export function levelProgress(xp: number): { level: number; current: number; needed: number; ratio: number } {
  const level = levelFromXp(xp);
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const current = xp - base;
  const needed = Math.max(1, next - base);
  return { level, current, needed, ratio: clamp(current / needed, 0, 1) };
}

export function applyRaceOutcome(save: SaveData, outcome: RaceOutcome, customization: Customization): RaceRewards {
  const profile = save.profile;
  const beforeLevel = levelFromXp(profile.xp);
  const unlocked: AchievementUnlock[] = [];

  profile.races += 1;
  profile.distance += Math.max(0, outcome.bestLap ? outcome.bestLap * 0 : 0);
  profile.topSpeed = Math.max(profile.topSpeed, outcome.topSpeed);
  profile.driftScore += outcome.driftScore;
  profile.boostUses += outcome.boostUses;
  if (outcome.cleanRace && outcome.position === 1) profile.cleanRaces += 1;
  if (!profile.tracksPlayed.includes(outcome.trackId)) profile.tracksPlayed.push(outcome.trackId);

  let xp = 0;
  let credits = 0;
  const solo = outcome.mode === 'timetrial' || outcome.mode === 'practice';
  if (outcome.mode !== 'practice') {
    xp += 80;
    credits += 90;
  }
  if (!solo) {
    if (outcome.position === 1) {
      xp += 180;
      credits += 260;
      profile.wins += 1;
      profile.podiums += 1;
    } else if (outcome.position <= 3) {
      xp += 120;
      credits += 160;
      profile.podiums += 1;
    } else {
      xp += 60;
      credits += 80;
    }
    credits += Math.max(0, outcome.totalRacers - outcome.position) * 12;
  } else if (outcome.mode === 'timetrial') {
    credits += 100;
    if (outcome.bestLap) {
      xp += 60;
      credits += 70;
    }
  }
  if (outcome.cleanRace) {
    xp += 45;
    credits += 60;
  }
  xp += Math.min(220, Math.round(outcome.driftScore / 120));
  credits += Math.min(140, Math.round(outcome.driftScore / 220));

  const newBestLap = outcome.bestLap !== null && (profile.bestLap === null || outcome.bestLap < profile.bestLap);
  if (newBestLap) {
    profile.bestLap = outcome.bestLap;
    xp += 50;
    credits += 80;
  }

  profile.history = [
    ...profile.history.slice(-49),
    {
      trackId: outcome.trackId,
      trackName: outcome.trackName,
      mode: outcome.mode,
      position: outcome.position,
      totalRacers: outcome.totalRacers,
      totalTime: outcome.totalTime,
      bestLap: outcome.bestLap,
      date: outcome.raceDate,
    },
  ];

  // Records.
  if (outcome.bestLap && outcome.bestLap > 3) {
    const record: LapRecord = {
      time: outcome.bestLap,
      kartId: save.lastSelection.kartId,
      mode: outcome.mode,
      date: outcome.raceDate,
    };
    const laps = save.records[outcome.trackId] ?? [];
    laps.push(record);
    laps.sort((a, b) => a.time - b.time);
    save.records[outcome.trackId] = laps.slice(0, 10);

    const races = save.raceRecords[outcome.trackId] ?? [];
    races.push({ ...record, time: outcome.totalTime });
    races.sort((a, b) => a.time - b.time);
    save.raceRecords[outcome.trackId] = races.slice(0, 10);
  }

  // Customization master check.
  const kartCust = save.karts[save.lastSelection.kartId];
  if (kartCust) {
    const defaults = KARTS.find((k) => k.id === save.lastSelection.kartId);
    const customized =
      Boolean(defaults) &&
      (kartCust.bodyColor !== defaults!.bodyColor ||
        kartCust.wheelColor !== '#14161c' ||
        kartCust.rimColor !== defaults!.accentColor ||
        kartCust.glowColor !== defaults!.accentColor ||
        kartCust.helmetColor !== defaults!.accentColor ||
        kartCust.decal !== 'stripe' ||
        kartCust.number !== '07');
    if (customized) profile.customizationMaster = true;
  }

  const rewardList = (id: string, test: boolean) => {
    if (!test) return;
    if (profile.achievements[id]) return;
    const def = ACHIEVEMENT_MAP.get(id);
    if (!def) return;
    profile.achievements[id] = outcome.raceDate;
    unlocked.push({ def, reward: def.reward, xp: def.xp });
    xp += def.xp;
    credits += def.reward;
  };

  rewardList('first-race', profile.races >= 1);
  rewardList('first-win', profile.wins >= 1);
  rewardList('podium', profile.podiums >= 3);
  rewardList('clean-race', profile.cleanRaces >= 1);
  rewardList('drift-1', outcome.driftScore >= 500);
  rewardList('drift-2', outcome.driftScore >= 5000);
  rewardList('drift-3', profile.driftScore >= 25000);
  rewardList('speed-1', outcome.topSpeed >= 55.5);
  rewardList('speed-2', outcome.topSpeed >= 72.2);
  rewardList('explore-1', profile.tracksPlayed.length >= TRACKS.length);
  rewardList('explore-2', profile.distance >= 50);
  rewardList('collect-1', profile.unlockedKarts.length >= KARTS.length);
  rewardList('collect-2', profile.customizationMaster);
  rewardList('boost-1', profile.boostUses >= 50);
  rewardList('tt-1', outcome.mode === 'timetrial' && newBestLap);

  profile.xp += xp;
  profile.credits += credits;
  profile.level = levelFromXp(profile.xp);
  save.lastSelection.kartId = save.lastSelection.kartId;

  void customization;
  return {
    xp,
    credits,
    levelUp: profile.level > beforeLevel,
    newLevel: profile.level,
    achievements: unlocked,
    newBestLap,
    newBestRace: false,
  };
}

export function applyGrandPrixRound(
  save: SaveData,
  outcome: RaceOutcome,
): { points: number; roundComplete: boolean; championshipComplete: boolean } {
  const gp = save.grandPrix;
  if (!gp) return { points: 0, roundComplete: false, championshipComplete: false };
  const pointsTable = [25, 20, 16, 13, 11, 10, 9, 8];
  const points = pointsTable[Math.min(pointsTable.length - 1, Math.max(0, outcome.position - 1))];
  const playerEntry = gp.standings.find((s) => s.isPlayer);
  if (playerEntry) playerEntry.points += points;
  gp.standings.forEach((s) => {
    if (s.isPlayer) return;
    const standing = outcome.standings.find((st) => st.name === s.name);
    const pos = standing ? standing.position : 8;
    s.points += pointsTable[Math.min(pointsTable.length - 1, Math.max(0, pos - 1))];
  });
  gp.standings.sort((a, b) => b.points - a.points);
  gp.round += 1;
  const roundComplete = true;
  const championshipComplete = gp.round >= gp.trackIds.length;
  gp.finished = championshipComplete;
  return { points, roundComplete, championshipComplete };
}

export function unlockKart(save: SaveData, kartId: string): boolean {
  const def = KARTS.find((k) => k.id === kartId);
  if (!def) return false;
  if (save.profile.unlockedKarts.includes(def.id)) return false;
  if (save.profile.credits < def.price) return false;
  save.profile.credits -= def.price;
  save.profile.unlockedKarts = [...save.profile.unlockedKarts, def.id];
  if (save.profile.unlockedKarts.length >= KARTS.length) {
    const defAch = ACHIEVEMENT_MAP.get('collect-1');
    if (defAch && !save.profile.achievements[defAch.id]) {
      save.profile.achievements[defAch.id] = Date.now();
      save.profile.credits += defAch.reward;
      save.profile.xp += defAch.xp;
      save.profile.level = levelFromXp(save.profile.xp);
    }
  }
  return true;
}

export function bestRecord(save: SaveData, trackId: string, mode?: GameMode): LapRecord | null {
  const list = save.records[trackId];
  if (!list || list.length === 0) return null;
  const filtered = mode ? list.filter((r) => r.mode === mode) : list;
  if (filtered.length === 0) return null;
  return [...filtered].sort((a, b) => a.time - b.time)[0];
}

export function saveGhost(save: SaveData, trackId: string, ghost: GhostData): void {
  const existing = save.ghosts[trackId];
  if (!existing || ghost.time < existing.time) {
    save.ghosts[trackId] = ghost;
  }
}

export function achievementProgress(profile: Profile): { unlocked: number; total: number } {
  return { unlocked: Object.keys(profile.achievements).length, total: ACHIEVEMENTS.length };
}

export function profileSummary(profile: Profile): string {
  return `${profile.races} races · ${profile.wins} wins · best lap ${formatTime(profile.bestLap)}`;
}

import type { GameMode, KartDef, Profile, Customization } from '../data/types';
import { Icon, Logo, type IconName } from './Common';
import { MenuBackground } from './MenuBackground';
import { TRACKS } from '../data/tracks';
import { levelProgress } from '../game/ProgressManager';
import { formatNumber, formatTime } from '../game/utils';

export type MenuRoute =
  | 'mode'
  | 'garage'
  | 'tracks'
  | 'career'
  | 'leaderboard'
  | 'settings'
  | 'credits';

interface MainMenuProps {
  profile: Profile;
  kart: KartDef;
  customization: Customization;
  onNavigate: (route: MenuRoute) => void;
  onQuickRace: () => void;
  reducedMotion: boolean;
  quality: 'low' | 'medium' | 'high';
  lastMode: GameMode;
}

const NAV: { route: MenuRoute; icon: IconName; label: string; desc: string }[] = [
  { route: 'mode', icon: 'flag', label: 'Race', desc: 'Choose mode, kart and circuit' },
  { route: 'garage', icon: 'garage', label: 'Garage', desc: 'Karts, paint and performance' },
  { route: 'tracks', icon: 'track', label: 'Tracks', desc: 'Six circuits across the Kartverse' },
  { route: 'career', icon: 'trophy', label: 'Career', desc: 'Profile, achievements, records' },
  { route: 'leaderboard', icon: 'credits', label: 'Records', desc: 'Local lap and race leaderboards' },
  { route: 'settings', icon: 'settings', label: 'Settings', desc: 'Graphics, audio and controls' },
];

export function MainMenu({
  profile,
  kart,
  customization,
  onNavigate,
  onQuickRace,
  reducedMotion,
  quality,
  lastMode,
}: MainMenuProps) {
  const level = levelProgress(profile.xp);
  const trackCount = profile.tracksPlayed.length;

  return (
    <div className="screen menu-screen">
      <MenuBackground
        def={kart}
        customization={customization}
        accent={kart.accentColor}
        reducedMotion={reducedMotion}
        quality={quality}
      />
      <div className="menu-bg-vignette" />
      <div className="menu-grain" />

      <header className="menu-topbar">
        <div className="menu-topbar-left">
          <Logo size="md" />
          <span className="menu-version">Season 01</span>
        </div>
        <div className="menu-profile">
          <button className="profile-chip" type="button" onClick={() => onNavigate('career')}>
            <span className="profile-avatar">{profile.name.slice(0, 2).toUpperCase()}</span>
            <span className="profile-meta">
              <span className="profile-name">{profile.name}</span>
              <span className="profile-level">LVL {level.level} · {Math.round(level.ratio * 100)}%</span>
            </span>
          </button>
          <span className="credit-chip">
            <Icon name="credits" size={13} />
            {formatNumber(profile.credits)}
          </span>
        </div>
      </header>

      <div className="menu-body">
        <div className="menu-hero">
          <div className="menu-hero-tag">Now racing · {TRACKS[0].name}</div>
          <h1 className="menu-hero-title">
            Built for
            <br />
            <em>the limit.</em>
          </h1>
          <p className="menu-hero-sub">
            Six circuits. Six kart classes. A full grid of rivals and a boost meter that
            rewards the brave. Drop in, find your line, and take the flag.
          </p>
          <div className="menu-actions">
            <button className="btn btn-primary btn-lg" type="button" onClick={onQuickRace}>
              <Icon name="play" size={16} />
              Quick Race
            </button>
            <button className="btn btn-secondary btn-lg" type="button" onClick={() => onNavigate('mode')}>
              <Icon name="flag" size={16} />
              Race Setup
            </button>
          </div>
        </div>

        <nav className="menu-nav" aria-label="Main menu">
          {NAV.map((item) => (
            <button
              key={item.route}
              type="button"
              className="menu-nav-item"
              onClick={() => onNavigate(item.route)}
            >
              <span className="menu-nav-icon">
                <Icon name={item.icon} size={19} />
              </span>
              <span className="menu-nav-text">
                <span className="menu-nav-label">{item.label}</span>
                <span className="menu-nav-desc">{item.desc}</span>
              </span>
              <span className="menu-nav-chevron">
                <Icon name="chevron" size={15} />
              </span>
            </button>
          ))}
        </nav>
      </div>

      <footer className="menu-footer-strip">
        <span className="menu-footer-item">
          <Icon name="trophy" size={12} /> <strong>{profile.wins}</strong> Wins
        </span>
        <span className="menu-footer-item">
          <Icon name="flag" size={12} /> <strong>{profile.races}</strong> Races
        </span>
        <span className="menu-footer-item">
          <Icon name="clock" size={12} /> Best lap <strong>{formatTime(profile.bestLap)}</strong>
        </span>
        <span className="menu-footer-item">
          <Icon name="track" size={12} /> <strong>{trackCount}/{TRACKS.length}</strong> Circuits
        </span>
        <span className="menu-footer-item" style={{ marginLeft: 'auto' }}>
          Last mode · <strong>{lastMode === 'quick' ? 'Quick Race' : lastMode === 'grandprix' ? 'Grand Prix' : lastMode === 'timetrial' ? 'Time Trial' : lastMode === 'practice' ? 'Practice' : 'Elimination'}</strong>
        </span>
      </footer>
    </div>
  );
}

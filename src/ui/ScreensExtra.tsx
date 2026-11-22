import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyBindings, Profile, SaveData, Settings } from '../data/types';
import { ACHIEVEMENTS } from '../data/achievements';
import { KARTS, getKart } from '../data/karts';
import { TRACKS } from '../data/tracks';
import { achievementProgress, levelProgress, xpForLevel } from '../game/ProgressManager';
import { formatNumber, formatTime } from '../game/utils';
import { Icon, Panel, Segmented, Slider, Toggle, type IconName } from './Common';

export function CareerScreen({
  profile,
  save,
  onBack,
  onStartGrandPrix,
  onResetProgress,
  onRename,
}: {
  profile: Profile;
  save: SaveData;
  onBack: () => void;
  onStartGrandPrix: () => void;
  onResetProgress: () => void;
  onRename: (name: string) => void;
}) {
  const level = levelProgress(profile.xp);
  const ach = achievementProgress(profile);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile.name);
  const [confirmReset, setConfirmReset] = useState(false);
  const gp = save.grandPrix;
  const history = [...profile.history].reverse().slice(0, 8);

  return (
    <div className="screen page">
      <header className="page-header">
        <button className="btn btn-ghost btn-sm" type="button" onClick={onBack}>
          <Icon name="chevron" size={14} className="rotate-180" />
          Menu
        </button>
        <div className="page-heading">
          <h1 className="page-title">Career</h1>
          <div className="page-sub">Profile · Achievements · Championship</div>
        </div>
        <span className="credit-chip">
          <Icon name="credits" size={13} />
          {formatNumber(profile.credits)}
        </span>
      </header>

      <div className="page-body">
        <div className="career-grid">
          <div className="career-col">
            <div className="profile-hero">
              <div className="profile-hero-avatar">{profile.name.slice(0, 2).toUpperCase()}</div>
              <div className="profile-hero-info">
                {editingName ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="number-input"
                      style={{ width: '100%', textAlign: 'left', letterSpacing: '0.04em' }}
                      value={nameDraft}
                      maxLength={18}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onRename(nameDraft.trim() || profile.name);
                          setEditingName(false);
                        }
                      }}
                      autoFocus
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      type="button"
                      onClick={() => {
                        onRename(nameDraft.trim() || profile.name);
                        setEditingName(false);
                      }}
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="profile-hero-name">{profile.name}</span>
                    <button
                      className="btn btn-ghost btn-sm"
                      type="button"
                      onClick={() => {
                        setNameDraft(profile.name);
                        setEditingName(true);
                      }}
                    >
                      Edit
                    </button>
                  </div>
                )}
                <div>
                  <div className="xp-label">
                    <span>LEVEL {level.level}</span>
                    <span>{level.current} / {level.needed} XP</span>
                  </div>
                  <div className="xp-track" style={{ marginTop: 4 }}>
                    <div className="xp-fill" style={{ width: `${level.ratio * 100}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-tile">
                <span className="stat-tile-value">{profile.races}</span>
                <span className="stat-tile-label">Races</span>
              </div>
              <div className="stat-tile">
                <span className="stat-tile-value" style={{ color: 'var(--yellow)' }}>{profile.wins}</span>
                <span className="stat-tile-label">Wins</span>
              </div>
              <div className="stat-tile">
                <span className="stat-tile-value">{profile.podiums}</span>
                <span className="stat-tile-label">Podiums</span>
              </div>
              <div className="stat-tile">
                <span className="stat-tile-value">{formatTime(profile.bestLap)}</span>
                <span className="stat-tile-label">Best Lap</span>
              </div>
              <div className="stat-tile">
                <span className="stat-tile-value">{formatNumber(profile.driftScore)}</span>
                <span className="stat-tile-label">Drift Pts</span>
              </div>
              <div className="stat-tile">
                <span className="stat-tile-value">{profile.tracksPlayed.length}/{TRACKS.length}</span>
                <span className="stat-tile-label">Circuits</span>
              </div>
              <div className="stat-tile">
                <span className="stat-tile-value">{profile.unlockedKarts.length}/{KARTS.length}</span>
                <span className="stat-tile-label">Karts</span>
              </div>
              <div className="stat-tile">
                <span className="stat-tile-value">{ach.unlocked}/{ach.total}</span>
                <span className="stat-tile-label">Trophies</span>
              </div>
            </div>

            <Panel eyebrow="Trophy Cabinet" title={`Achievements · ${ach.unlocked}/${ach.total}`}>
              <div className="achievement-grid">
                {ACHIEVEMENTS.map((a) => {
                  const unlocked = Boolean(profile.achievements[a.id]);
                  return (
                    <div key={a.id} className={`achievement-card ${unlocked ? 'is-unlocked' : ''}`}>
                      <span className="achievement-icon">
                        <Icon name={unlocked ? 'trophy' : 'lock'} size={15} />
                      </span>
                      <div>
                        <div className="achievement-name">{a.name}</div>
                        <div className="achievement-desc">{a.description}</div>
                        <div className="achievement-reward">+{formatNumber(a.reward)} cr · +{a.xp} XP</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>

          <div className="career-col">
            <Panel eyebrow="Championship" title="Grand Prix">
              <div className="gp-card">
                {gp && !gp.finished ? (
                  <>
                    <div className="summary-row">
                      <span>Round</span>
                      <span>{gp.round + 1} / {gp.trackIds.length}</span>
                    </div>
                    <div className="gp-track-list">
                      {gp.trackIds.map((id, i) => {
                        const t = TRACKS.find((x) => x.id === id);
                        if (!t) return null;
                        return (
                          <div className="gp-track-row" key={id}>
                            <span className="gp-track-name">
                              <span className={`gp-dot ${i < gp.round ? 'done' : i === gp.round ? 'current' : ''}`} />
                              {t.name}
                            </span>
                            <span className="mono faint" style={{ fontSize: 10 }}>
                              {i < gp.round ? 'Complete' : i === gp.round ? 'Next' : '—'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <button className="btn btn-primary btn-sm" type="button" onClick={onStartGrandPrix}>
                      <Icon name="flag" size={13} /> Continue championship
                    </button>
                  </>
                ) : (
                  <>
                    <p className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
                      Four rounds. Points awarded each race. Highest total takes the Kartverse crown.
                    </p>
                    <button className="btn btn-primary btn-sm" type="button" onClick={onStartGrandPrix}>
                      <Icon name="trophy" size={13} /> {gp?.finished ? 'New championship' : 'Start championship'}
                    </button>
                  </>
                )}
              </div>

              {gp && gp.standings.length > 0 && (
                <div>
                  <div className="eyebrow" style={{ marginBottom: 6 }}>Championship Standings</div>
                  <table className="standings-table">
                    <thead>
                      <tr>
                        <th>Pos</th>
                        <th>Driver</th>
                        <th>Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gp.standings.map((s, i) => (
                        <tr key={s.name} className={s.isPlayer ? 'is-player' : ''}>
                          <td className="standings-pos">{i + 1}</td>
                          <td>{s.isPlayer ? profile.name : s.name}</td>
                          <td className="mono">{s.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel eyebrow="Recent" title="Race History">
              {history.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-state-icon">
                    <Icon name="clock" size={28} />
                  </span>
                  <span className="empty-state-title">No races yet</span>
                  <span className="empty-state-desc">Complete a race to build your history.</span>
                </div>
              ) : (
                <div className="leaderboard-list">
                  {history.map((h, i) => (
                    <div className="leaderboard-row" key={`${h.date}-${i}`} style={{ gridTemplateColumns: '28px 1fr auto auto' }}>
                      <span className="leaderboard-rank">{h.position}</span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ fontSize: 12 }}>{h.trackName}</span>
                        <span className="leaderboard-meta">{new Date(h.date).toLocaleDateString()} · {h.mode}</span>
                      </span>
                      <span className="leaderboard-time">{formatTime(h.bestLap)}</span>
                      <span className="leaderboard-meta hide-sm">/{h.totalRacers}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel eyebrow="Data" title="Save Management">
              <p className="control-hint">
                Progress is stored locally in this browser. Export a backup before clearing site data.
              </p>
              <div className="save-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  type="button"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `kartverse-save-${new Date().toISOString().slice(0, 10)}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Icon name="arrow" size={13} /> Export
                </button>
                <button className="btn btn-danger btn-sm" type="button" onClick={() => setConfirmReset(true)}>
                  Reset progress
                </button>
              </div>
              <div className="summary-row">
                <span>XP</span>
                <span className="mono">{formatNumber(profile.xp)}</span>
              </div>
              <div className="summary-row">
                <span>Next level at</span>
                <span className="mono">{formatNumber(xpForLevel(level.level + 1))}</span>
              </div>
            </Panel>
          </div>
        </div>
      </div>

      {confirmReset && (
        <div className="overlay">
          <div className="modal" style={{ width: 'min(420px, 100%)' }}>
            <div>
              <div className="modal-sub">Irreversible</div>
              <h2 className="modal-title" style={{ marginTop: 6 }}>Reset all progress?</h2>
            </div>
            <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
              This clears your profile, credits, unlocks, achievements, records and ghosts. Settings are preserved.
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" type="button" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                type="button"
                onClick={() => {
                  setConfirmReset(false);
                  onResetProgress();
                }}
              >
                Reset everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function LeaderboardScreen({
  save,
  onBack,
}: {
  save: SaveData;
  onBack: () => void;
}) {
  const [trackId, setTrackId] = useState(TRACKS[0].id);
  const [tab, setTab] = useState<'lap' | 'race'>('lap');
  const list = (tab === 'lap' ? save.records[trackId] : save.raceRecords[trackId]) ?? [];
  const track = TRACKS.find((t) => t.id === trackId) ?? TRACKS[0];

  return (
    <div className="screen page">
      <header className="page-header">
        <button className="btn btn-ghost btn-sm" type="button" onClick={onBack}>
          <Icon name="chevron" size={14} className="rotate-180" />
          Menu
        </button>
        <div className="page-heading">
          <h1 className="page-title">Records</h1>
          <div className="page-sub">Local leaderboards · Stored on this device</div>
        </div>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'lap', label: 'Best Laps' },
            { value: 'race', label: 'Race Times' },
          ]}
        />
      </header>

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 210px) minmax(0, 1fr)', gap: 18, minHeight: 0 }}>
          <div className="settings-nav">
            {TRACKS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`settings-nav-item ${trackId === t.id ? 'is-active' : ''}`}
                onClick={() => setTrackId(t.id)}
              >
                <span className="settings-nav-icon">
                  <Icon name="track" size={15} />
                </span>
                {t.name}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0, overflowY: 'auto' }}>
            <Panel eyebrow={tab === 'lap' ? 'Fastest Laps' : 'Fastest Races'} title={track.name}>
              {list.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-state-icon">
                    <Icon name="clock" size={30} />
                  </span>
                  <span className="empty-state-title">No records on this circuit</span>
                  <span className="empty-state-desc">
                    Complete a race or time trial on {track.name} to set your first benchmark.
                  </span>
                </div>
              ) : (
                <div className="leaderboard-list">
                  {list.map((r, i) => (
                    <div className="leaderboard-row" key={`${r.time}-${i}`}>
                      <span className="leaderboard-rank">{i + 1}</span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ fontSize: 12 }}>PLAYER ONE</span>
                        <span className="leaderboard-meta">{getKart(r.kartId).name} · {r.mode}</span>
                      </span>
                      <span className="leaderboard-time">{formatTime(r.time)}</span>
                      <span className="leaderboard-meta hide-sm">{new Date(r.date).toLocaleDateString()}</span>
                      <span className="leaderboard-meta hide-sm">{tab === 'lap' ? 'LAP' : 'RACE'}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <p className="control-hint">
              Leaderboards are stored locally. No account or network connection is required, and nothing is
              uploaded — these are your personal records on this device.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsScreen({
  settings,
  onChange,
  onBack,
  onReset,
  onExport,
  onImport,
  onToast,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onBack: () => void;
  onReset: () => void;
  onExport: () => void;
  onImport: (text: string) => void;
  onToast: (text: string, kind?: 'info' | 'warn' | 'success') => void;
}) {
  const [section, setSection] = useState<'graphics' | 'audio' | 'gameplay' | 'controls' | 'accessibility' | 'data'>('graphics');
  const [listening, setListening] = useState<keyof KeyBindings | null>(null);
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!listening) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setListening(null);
        return;
      }
      onChange({ bindings: { ...settings.bindings, [listening]: e.code } });
      setListening(null);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [listening, onChange, settings.bindings]);

  const sections: { id: typeof section; label: string; icon: IconName }[] = [
    { id: 'graphics', label: 'Graphics', icon: 'camera' },
    { id: 'audio', label: 'Audio', icon: 'sound' },
    { id: 'gameplay', label: 'Gameplay', icon: 'flag' },
    { id: 'controls', label: 'Controls', icon: 'settings' },
    { id: 'accessibility', label: 'Accessibility', icon: 'star' },
    { id: 'data', label: 'Save Data', icon: 'credits' },
  ];

  const bindingLabels: { key: keyof KeyBindings; label: string }[] = [
    { key: 'accelerate', label: 'Accelerate' },
    { key: 'brake', label: 'Brake / Reverse' },
    { key: 'left', label: 'Steer Left' },
    { key: 'right', label: 'Steer Right' },
    { key: 'drift', label: 'Drift / Handbrake' },
    { key: 'boost', label: 'Boost' },
    { key: 'item', label: 'Use Item' },
    { key: 'reset', label: 'Recover Kart' },
    { key: 'camera', label: 'Change Camera' },
    { key: 'pause', label: 'Pause' },
  ];

  return (
    <div className="screen page">
      <header className="page-header">
        <button className="btn btn-ghost btn-sm" type="button" onClick={onBack}>
          <Icon name="chevron" size={14} className="rotate-180" />
          Menu
        </button>
        <div className="page-heading">
          <h1 className="page-title">Settings</h1>
          <div className="page-sub">Every option applies immediately</div>
        </div>
      </header>

      <div className="page-body">
        <div className="settings-layout">
          <div className="settings-nav">
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`settings-nav-item ${section === s.id ? 'is-active' : ''}`}
                onClick={() => setSection(s.id)}
              >
                <span className="settings-nav-icon">
                  <Icon name={s.icon} size={15} />
                </span>
                {s.label}
              </button>
            ))}
          </div>

          <div className="settings-panel">
            {section === 'graphics' && (
              <>
                <div className="settings-group">
                  <div className="settings-group-title">Render Quality</div>
                  <Segmented
                    label="Quality Preset"
                    value={settings.quality}
                    onChange={(v) => onChange({ quality: v })}
                    options={[
                      { value: 'low', label: 'Low' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'high', label: 'High' },
                    ]}
                  />
                  <Slider
                    label="Resolution Scale"
                    value={settings.resolutionScale}
                    min={0.5}
                    max={1}
                    step={0.05}
                    onChange={(v) => onChange({ resolutionScale: v })}
                    format={(v) => `${Math.round(v * 100)}%`}
                    hint="Lower this first if the frame rate drops."
                  />
                  <Toggle label="Dynamic Shadows" checked={settings.shadows} onChange={(v) => onChange({ shadows: v })} />
                  <Toggle label="Anti-Aliasing" checked={settings.antiAliasing} onChange={(v) => onChange({ antiAliasing: v })} hint="Requires a page reload to fully apply." />
                </div>
                <div className="settings-group">
                  <div className="settings-group-title">Effects</div>
                  <Toggle label="Post Effects" checked={settings.effects} onChange={(v) => onChange({ effects: v })} />
                  <Toggle label="Particles" checked={settings.particles} onChange={(v) => onChange({ particles: v })} hint="Tire smoke, sparks, dust and boost trails." />
                  <Slider
                    label="Motion Intensity"
                    value={settings.motionIntensity}
                    onChange={(v) => onChange({ motionIntensity: v })}
                    format={(v) => `${Math.round(v * 100)}%`}
                  />
                </div>
              </>
            )}

            {section === 'audio' && (
              <>
                <div className="settings-group">
                  <div className="settings-group-title">Mix</div>
                  <Toggle label="Mute All" checked={settings.muted} onChange={(v) => onChange({ muted: v })} />
                  <Slider label="Master Volume" value={settings.masterVolume} onChange={(v) => onChange({ masterVolume: v })} format={(v) => `${Math.round(v * 100)}%`} />
                  <Slider label="Music Volume" value={settings.musicVolume} onChange={(v) => onChange({ musicVolume: v })} format={(v) => `${Math.round(v * 100)}%`} />
                  <Slider label="Effects Volume" value={settings.sfxVolume} onChange={(v) => onChange({ sfxVolume: v })} format={(v) => `${Math.round(v * 100)}%`} />
                  <Toggle label="Music Enabled" checked={settings.musicEnabled} onChange={(v) => onChange({ musicEnabled: v })} />
                </div>
                <p className="control-hint">
                  Audio is synthesised procedurally with the Web Audio API — no downloads required. Browser
                  policy requires one click before sound starts.
                </p>
              </>
            )}

            {section === 'gameplay' && (
              <>
                <div className="settings-group">
                  <div className="settings-group-title">Race Defaults</div>
                  <Segmented
                    label="Difficulty"
                    value={settings.difficulty}
                    onChange={(v) => onChange({ difficulty: v })}
                    options={[
                      { value: 'easy', label: 'Easy' },
                      { value: 'normal', label: 'Normal' },
                      { value: 'hard', label: 'Hard' },
                      { value: 'pro', label: 'Pro' },
                    ]}
                  />
                  <Slider label="Default Laps" value={settings.laps} min={1} max={9} step={1} onChange={(v) => onChange({ laps: v })} format={(v) => `${v}`} />
                  <Segmented
                    label="Speed Units"
                    value={settings.units}
                    onChange={(v) => onChange({ units: v })}
                    options={[
                      { value: 'kmh', label: 'km/h' },
                      { value: 'mph', label: 'mph' },
                    ]}
                  />
                </div>
                <div className="settings-group">
                  <div className="settings-group-title">Handling</div>
                  <Slider label="Steering Sensitivity" value={settings.steeringSensitivity} min={0.4} max={2} onChange={(v) => onChange({ steeringSensitivity: v })} format={(v) => `${v.toFixed(2)}x`} />
                  <Slider label="Camera Sensitivity" value={settings.cameraSensitivity} min={0.4} max={2} onChange={(v) => onChange({ cameraSensitivity: v })} format={(v) => `${v.toFixed(2)}x`} />
                  <Slider label="Camera Shake" value={settings.cameraShake} onChange={(v) => onChange({ cameraShake: v })} format={(v) => `${Math.round(v * 100)}%`} />
                </div>
              </>
            )}

            {section === 'controls' && (
              <>
                <div className="settings-group">
                  <div className="settings-group-title">Keyboard Bindings</div>
                  <p className="control-hint">Click a binding then press a key. Escape cancels.</p>
                  <div className="settings-rows">
                    {bindingLabels.map((b) => (
                      <div className="binding-row" key={b.key}>
                        <span className="binding-label">{b.label}</span>
                        <button
                          type="button"
                          className={`binding-btn ${listening === b.key ? 'is-listening' : ''}`}
                          onClick={() => setListening(b.key)}
                        >
                          {listening === b.key ? 'Press key…' : settings.bindings[b.key].replace('Key', '').replace('Left', 'L').replace('Right', 'R')}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="settings-group">
                  <div className="settings-group-title">Reference</div>
                  <div className="controls-grid">
                    <div className="key-row"><span className="keycap">W</span><span className="key-desc">Throttle</span></div>
                    <div className="key-row"><span className="keycap">S</span><span className="key-desc">Brake</span></div>
                    <div className="key-row"><span className="keycap">A D</span><span className="key-desc">Steer</span></div>
                    <div className="key-row"><span className="keycap">SPACE</span><span className="key-desc">Drift</span></div>
                    <div className="key-row"><span className="keycap">SHIFT</span><span className="key-desc">Boost</span></div>
                    <div className="key-row"><span className="keycap">C</span><span className="key-desc">Camera</span></div>
                    <div className="key-row"><span className="keycap">R</span><span className="key-desc">Recover</span></div>
                    <div className="key-row"><span className="keycap">ESC</span><span className="key-desc">Pause</span></div>
                  </div>
                </div>
              </>
            )}

            {section === 'accessibility' && (
              <div className="settings-group">
                <div className="settings-group-title">Accessibility</div>
                <Toggle
                  label="Color-blind Friendly Palette"
                  checked={settings.colorblind}
                  onChange={(v) => onChange({ colorblind: v })}
                  hint="Shifts accents to a blue/orange high-distinction pair."
                />
                <Toggle
                  label="Reduced Motion"
                  checked={settings.reducedMotion}
                  onChange={(v) => onChange({ reducedMotion: v })}
                  hint="Disables non-essential animation and camera motion."
                />
                <Toggle
                  label="High Contrast UI"
                  checked={settings.highContrast}
                  onChange={(v) => onChange({ highContrast: v })}
                />
                <Toggle
                  label="Subtitles & Alerts"
                  checked={settings.subtitles}
                  onChange={(v) => onChange({ subtitles: v })}
                  hint="Shows race alerts and status messages on screen."
                />
                <Slider
                  label="UI Scale"
                  value={settings.uiScale}
                  min={0.8}
                  max={1.3}
                  step={0.05}
                  onChange={(v) => onChange({ uiScale: v })}
                  format={(v) => `${Math.round(v * 100)}%`}
                />
              </div>
            )}

            {section === 'data' && (
              <>
                <div className="settings-group">
                  <div className="settings-group-title">Backup</div>
                  <div className="save-actions">
                    <button className="btn btn-secondary btn-sm" type="button" onClick={onExport}>
                      <Icon name="arrow" size={13} /> Export save
                    </button>
                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowImport(true)}>
                      Import save
                    </button>
                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => fileRef.current?.click()}>
                      Load file
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="application/json"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => onImport(String(reader.result ?? ''));
                        reader.readAsText(file);
                        e.target.value = '';
                      }}
                    />
                  </div>
                  {showImport && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <textarea
                        className="number-input"
                        style={{ width: '100%', minHeight: 100, textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 0 }}
                        placeholder="Paste save JSON here…"
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                      />
                      <div className="save-actions">
                        <button
                          className="btn btn-primary btn-sm"
                          type="button"
                          onClick={() => {
                            onImport(importText);
                            setImportText('');
                            setShowImport(false);
                          }}
                        >
                          Import
                        </button>
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => setShowImport(false)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="settings-group">
                  <div className="settings-group-title">Danger Zone</div>
                  <p className="control-hint">
                    Reset restores default settings and clears all progression, unlocks and records.
                  </p>
                  <button
                    className="btn btn-danger btn-sm"
                    type="button"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() => {
                      onReset();
                      onToast('All data reset', 'warn');
                    }}
                  >
                    Reset all data
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CreditsScreen({ onBack }: { onBack: () => void }) {
  const sections = [
    {
      title: 'KARTVERSE',
      lines: ['A premium browser racing game', 'Built with React, TypeScript and Three.js', 'No external assets, no network calls'],
    },
    {
      title: 'Engineering',
      lines: ['Custom fixed-step arcade physics', 'Spline-based procedural circuits', 'Procedural kart geometry and materials', 'Web Audio synthesised sound design'],
    },
    {
      title: 'Design',
      lines: ['Six kart classes with distinct handling', 'Six themed circuits', 'Five race modes plus Grand Prix', 'Full garage customization'],
    },
    {
      title: 'Technology',
      lines: ['Three.js · WebGL renderer', 'React 18 · Vite', 'TypeScript strict mode', 'LocalStorage persistence'],
    },
  ];
  return (
    <div className="screen page">
      <header className="page-header">
        <button className="btn btn-ghost btn-sm" type="button" onClick={onBack}>
          <Icon name="chevron" size={14} className="rotate-180" />
          Menu
        </button>
        <div className="page-heading">
          <h1 className="page-title">Credits</h1>
          <div className="page-sub">Built in the browser, for the browser</div>
        </div>
      </header>
      <div className="page-body scroll">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          {sections.map((s) => (
            <Panel key={s.title} eyebrow="Kartverse" title={s.title}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {s.lines.map((l) => (
                  <span key={l} className="muted" style={{ fontSize: 12, lineHeight: 1.55 }}>{l}</span>
                ))}
              </div>
            </Panel>
          ))}
        </div>
        <div style={{ marginTop: 20, textAlign: 'center', padding: '10px 0 30px' }}>
          <p className="faint mono" style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            KARTVERSE · Season 01 · Local Build
          </p>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Customization,
  DecalId,
  Difficulty,
  ExhaustId,
  GameMode,
  KartClassId,
  KartDef,
  Profile,
  SaveData,
  Settings,
  SpoilerId,
  TrackDef,
} from '../data/types';
import { KARTS, getKart } from '../data/karts';
import { TRACKS } from '../data/tracks';
import { ShowroomScene } from '../game/ShowroomScene';
import { bestRecord, levelProgress, unlockKart } from '../game/ProgressManager';
import { formatNumber, formatTime, MODE_LABELS, DIFFICULTY_LABELS } from '../game/utils';
import { Icon, Panel, ProgressRing, Segmented, Slider, StatBars, TrackPreview, type IconName } from './Common';

export interface Selection {
  mode: GameMode;
  trackId: string;
  kartId: KartClassId;
  difficulty: Difficulty;
  laps: number;
  opponents: number;
}

const MODES: { id: GameMode; name: string; desc: string; icon: IconName }[] = [
  { id: 'quick', name: 'Quick Race', desc: 'Full grid, three laps, instant action.', icon: 'flag' },
  { id: 'grandprix', name: 'Grand Prix', desc: 'Four-round championship with points.', icon: 'trophy' },
  { id: 'timetrial', name: 'Time Trial', desc: 'Solo against the clock and your ghost.', icon: 'clock' },
  { id: 'practice', name: 'Practice', desc: 'Free driving. No pressure, no timer.', icon: 'drift' },
  { id: 'elimination', name: 'Elimination', desc: 'Last place drops out every interval.', icon: 'bolt' },
];

const DECALS: { id: DecalId; label: string }[] = [
  { id: 'none', label: 'Clean' },
  { id: 'stripe', label: 'Stripe' },
  { id: 'flames', label: 'Flames' },
  { id: 'circuit', label: 'Circuit' },
  { id: 'star', label: 'Star' },
];

const SPOILERS: { id: SpoilerId; label: string }[] = [
  { id: 'low', label: 'Low' },
  { id: 'mid', label: 'Mid' },
  { id: 'high', label: 'High' },
  { id: 'wing', label: 'Wing' },
];

const EXHAUSTS: { id: ExhaustId; label: string }[] = [
  { id: 'single', label: 'Single' },
  { id: 'dual', label: 'Dual' },
  { id: 'jet', label: 'Jet' },
];

const PAINTS = [
  '#ff5a2e', '#ffb703', '#ffd166', '#2fffb4', '#29e0ff', '#3d7bff',
  '#8d63ff', '#ff2f8d', '#ff3b57', '#f2f5fa', '#9aa4b4', '#14161c',
  '#1f8cff', '#c9ff4d', '#ff8a4c', '#00c2a8',
];

const WHEELS = ['#14161c', '#2b2f3a', '#4a5060', '#8b95a8', '#f2f5fa', '#ff5a2e', '#29e0ff', '#ffd166'];
const RIMS = ['#f2f5fa', '#8b95a8', '#ff5a2e', '#29e0ff', '#ffd166', '#2fffb4', '#8d63ff', '#ff2f8d'];
const GLOWS = ['#29e0ff', '#ff5a2e', '#2fffb4', '#8d63ff', '#ff2f8d', '#ffd166', '#ff3b57', '#ffffff'];
const HELMETS = ['#ff5a2e', '#29e0ff', '#ffd166', '#2fffb4', '#8d63ff', '#f2f5fa', '#ff2f8d', '#14161c'];

interface SetupScreenProps {
  selection: Selection;
  profile: Profile;
  customization: Customization;
  settings: Settings;
  records: SaveData['records'];
  onSettingsChange: (patch: Partial<Settings>) => void;
  onChange: (next: Partial<Selection>) => void;
  onCustomizationChange: (next: Customization) => void;
  onStart: () => void;
  onBack: () => void;
  onUnlock: (kartId: KartClassId) => void;
  onNavigateGarage: () => void;
}

type SetupTab = 'mode' | 'track' | 'kart' | 'options';

export function SetupScreen({
  selection,
  profile,
  customization,
  settings,
  records,
  onSettingsChange,
  onChange,
  onCustomizationChange,
  onStart,
  onBack,
  onUnlock,
  onNavigateGarage,
}: SetupScreenProps) {
  const [tab, setTab] = useState<SetupTab>('mode');
  const track = TRACKS.find((t) => t.id === selection.trackId) ?? TRACKS[0];
  const kart = getKart(selection.kartId);
  const trackPoints = useMemo(
    () => track.points.map((p) => ({ x: p.x, z: p.z })),
    [track],
  );
  const record = bestRecord({ records } as SaveData, track.id);

  const solo = selection.mode === 'timetrial' || selection.mode === 'practice';
  const canStart = profile.unlockedKarts.includes(selection.kartId);

  return (
    <div className="screen page">
      <header className="page-header">
        <button className="btn btn-ghost btn-sm" type="button" onClick={onBack}>
          <Icon name="chevron" size={14} className="rotate-180" />
          Menu
        </button>
        <div className="page-heading">
          <h1 className="page-title">Race Setup</h1>
          <div className="page-sub">{MODE_LABELS[selection.mode]} · {track.name}</div>
        </div>
        <div className="credit-chip">
          <Icon name="credits" size={13} />
          {formatNumber(profile.credits)}
        </div>
      </header>

      <div className="page-body">
        <div className="setup-grid">
          <div className="setup-col">
            <div className="custom-tabs">
              {([
                { id: 'mode', label: 'Mode' },
                { id: 'track', label: 'Circuit' },
                { id: 'kart', label: 'Kart' },
                { id: 'options', label: 'Options' },
              ] as { id: SetupTab; label: string }[]).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`custom-tab ${tab === t.id ? 'is-active' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'mode' && (
              <Panel eyebrow="Step 01" title="Select Mode">
                <div className="mode-grid">
                  {MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`mode-card ${selection.mode === m.id ? 'is-selected' : ''}`}
                      onClick={() => onChange({ mode: m.id })}
                    >
                      <span className="mode-card-icon">
                        <Icon name={m.icon} size={18} />
                      </span>
                      <span className="mode-card-name">{m.name}</span>
                      <span className="mode-card-desc">{m.desc}</span>
                    </button>
                  ))}
                </div>
                <p className="control-hint">
                  {selection.mode === 'grandprix'
                    ? 'Grand Prix runs four rounds with points. Progress is saved between rounds.'
                    : selection.mode === 'timetrial'
                      ? 'Time Trial records your best lap and stores a ghost of your fastest run.'
                      : selection.mode === 'practice'
                        ? 'Practice disables the race clock, AI opponents and lap limits.'
                        : selection.mode === 'elimination'
                          ? 'Elimination removes the last-place racer every interval until one remains.'
                          : 'Quick Race drops you straight onto the grid against a full field of rivals.'}
                </p>
              </Panel>
            )}

            {tab === 'track' && (
              <Panel eyebrow="Step 02" title="Select Circuit">
                <div className="track-grid">
                  {TRACKS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`track-card ${selection.trackId === t.id ? 'is-selected' : ''}`}
                      onClick={() => onChange({ trackId: t.id })}
                    >
                      <div
                        className="track-card-art"
                        style={{
                          background: `radial-gradient(circle at 50% 80%, ${t.palette.accent}22, transparent 70%), linear-gradient(160deg, ${t.palette.skyTop}, ${t.palette.fog})`,
                        }}
                      >
                        <TrackPreview points={t.points.map((p) => ({ x: p.x, z: p.z }))} accent={t.palette.accent} />
                        <span className="track-card-badge">Round {TRACKS.indexOf(t) + 1}</span>
                      </div>
                      <div className="track-card-body">
                        <span className="track-card-name">{t.name}</span>
                        <span className="track-card-tag">{t.tagline}</span>
                        <span className="track-card-meta">
                          <span>{t.laps} Laps</span>
                          <span className="difficulty-dots">
                            {[1, 2, 3].map((n) => (
                              <span key={n} className={`difficulty-dot ${n <= t.difficulty ? 'on' : ''}`} />
                            ))}
                          </span>
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </Panel>
            )}

            {tab === 'kart' && (
              <Panel eyebrow="Step 03" title="Select Kart">
                <div className="kart-strip">
                  {KARTS.map((k) => {
                    const unlocked = profile.unlockedKarts.includes(k.id);
                    return (
                      <button
                        key={k.id}
                        type="button"
                        className={`kart-chip ${selection.kartId === k.id ? 'is-selected' : ''} ${unlocked ? '' : 'is-locked'}`}
                        onClick={() => {
                          if (unlocked) onChange({ kartId: k.id });
                          else onUnlock(k.id);
                        }}
                      >
                        <span className="kart-chip-swatch" style={{ background: k.bodyColor }} />
                        <span className="kart-chip-name">{k.name}</span>
                        <span className="kart-chip-class">
                          {unlocked ? k.className : `${formatNumber(k.price)} cr`}
                        </span>
                        {!unlocked && <Icon name="lock" size={11} />}
                      </button>
                    );
                  })}
                </div>
                <StatBars stats={kart.stats} />
                <p className="control-hint">{kart.description}</p>
                <button className="btn btn-ghost btn-sm" type="button" onClick={onNavigateGarage} style={{ alignSelf: 'flex-start' }}>
                  <Icon name="garage" size={14} /> Open garage
                </button>
              </Panel>
            )}

            {tab === 'options' && (
              <Panel eyebrow="Step 04" title="Race Options">
                <div className="settings-rows">
                  <Segmented
                    label="Difficulty"
                    value={selection.difficulty}
                    onChange={(v) => onChange({ difficulty: v })}
                    options={(['easy', 'normal', 'hard', 'pro'] as Difficulty[]).map((d) => ({
                      value: d,
                      label: DIFFICULTY_LABELS[d],
                    }))}
                  />
                  {!solo && (
                    <>
                      <Slider
                        label="Race Length"
                        value={selection.laps}
                        min={1}
                        max={9}
                        step={1}
                        onChange={(v) => onChange({ laps: v })}
                        format={(v) => `${v} lap${v === 1 ? '' : 's'}`}
                      />
                      <Slider
                        label="Opponents"
                        value={selection.opponents}
                        min={1}
                        max={7}
                        step={1}
                        onChange={(v) => onChange({ opponents: v })}
                        format={(v) => `${v} rivals`}
                      />
                    </>
                  )}
                  <Segmented
                    label="Speed Units"
                    value={settings.units}
                    onChange={(units) => onSettingsChange({ units })}
                    options={[
                      { value: 'kmh', label: 'km/h' },
                      { value: 'mph', label: 'mph' },
                    ]}
                  />
                  <p className="control-hint">
                    Difficulty changes AI pace, cornering confidence, boost usage and mistake rate.
                  </p>
                </div>
              </Panel>
            )}
          </div>

          <div className="setup-col">
            <Panel eyebrow="Preview" title={track.name} actions={<span className="mono faint" style={{ fontSize: 10 }}>{track.laps} laps</span>}>
              <div
                style={{
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                  background: `radial-gradient(circle at 50% 70%, ${track.palette.accent}18, transparent 68%), linear-gradient(160deg, ${track.palette.skyTop}, ${track.palette.fog})`,
                  padding: 6,
                }}
              >
                <TrackPreview points={trackPoints} accent={track.palette.accent} />
              </div>
              <p className="control-hint">{track.description}</p>
              <div className="summary-box">
                <div className="summary-row">
                  <span>Mode</span>
                  <span>{MODE_LABELS[selection.mode]}</span>
                </div>
                <div className="summary-row">
                  <span>Kart</span>
                  <span>{kart.name}</span>
                </div>
                <div className="summary-row">
                  <span>Difficulty</span>
                  <span>{DIFFICULTY_LABELS[selection.difficulty]}</span>
                </div>
                <div className="summary-row">
                  <span>Length</span>
                  <span>{solo ? '—' : `${selection.laps} laps`}</span>
                </div>
                <div className="summary-row">
                  <span>Grid</span>
                  <span>{solo ? 'Solo' : `${selection.opponents + 1} karts`}</span>
                </div>
                <div className="summary-row">
                  <span>Best lap</span>
                  <span>{record ? formatTime(record.time) : '—'}</span>
                </div>
              </div>
            </Panel>

            <Panel eyebrow="Selected Kart" title={kart.name}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 11,
                    background: `linear-gradient(140deg, ${customization.bodyColor}, ${kart.accentColor})`,
                    border: '1px solid rgba(255,255,255,0.14)',
                    flex: '0 0 auto',
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 650 }}>{kart.className} Class</span>
                  <span className="faint" style={{ fontSize: 11 }}>{kart.tagline}</span>
                </div>
              </div>
              <div className="option-row">
                {DECALS.slice(0, 3).map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className={`option-pill ${customization.decal === d.id ? 'is-selected' : ''}`}
                    onClick={() => onCustomizationChange({ ...customization, decal: d.id })}
                  >
                    {d.label}
                  </button>
                ))}
                <button className="option-pill" type="button" onClick={onNavigateGarage}>
                  More…
                </button>
              </div>
            </Panel>
          </div>
        </div>
      </div>

      <footer className="page-footer">
        <span className="faint mono" style={{ fontSize: 10.5 }}>
          {canStart ? 'All systems ready' : 'Kart locked — unlock in the garage'}
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" type="button" onClick={onBack}>
            Back
          </button>
          <button className="btn btn-primary" type="button" disabled={!canStart} onClick={onStart}>
            <Icon name="play" size={15} />
            Start Race
          </button>
        </div>
      </footer>
    </div>
  );
}

export function GarageScreen({
  profile,
  customization,
  settings,
  kartId,
  onChangeKart,
  onChangeCustomization,
  onUnlock,
  onBack,
  onRace,
  onToast,
}: {
  profile: Profile;
  customization: Customization;
  settings: Settings;
  kartId: KartClassId;
  onChangeKart: (id: KartClassId) => void;
  onChangeCustomization: (c: Customization) => void;
  onUnlock: (id: KartClassId) => void;
  onBack: () => void;
  onRace: () => void;
  onToast: (text: string, kind?: 'info' | 'warn' | 'success') => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<ShowroomScene | null>(null);
  const kart = getKart(kartId);
  const unlocked = profile.unlockedKarts.includes(kartId);
  const [tab, setTab] = useState<'paint' | 'wheels' | 'decal' | 'details' | 'stats'>('paint');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let scene: ShowroomScene | null = null;
    try {
      scene = new ShowroomScene(host, settings.quality);
      scene.setKart(kart, customization);
      sceneRef.current = scene;
    } catch {
      sceneRef.current = null;
    }
    return () => {
      scene?.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.quality]);

  useEffect(() => {
    sceneRef.current?.setKart(kart, customization);
  }, [kart]);

  useEffect(() => {
    sceneRef.current?.setColor(customization);
  }, [customization]);

  const update = (patch: Partial<Customization>) => {
    onChangeCustomization({ ...customization, ...patch });
  };

  const tryUnlock = () => {
    if (unlocked) return;
    if (profile.credits < kart.price) {
      onToast(`Need ${formatNumber(kart.price - profile.credits)} more credits`, 'warn');
      return;
    }
    onUnlock(kartId);
    onToast(`${kart.name} unlocked`, 'success');
  };

  return (
    <div className="screen page">
      <header className="page-header">
        <button className="btn btn-ghost btn-sm" type="button" onClick={onBack}>
          <Icon name="chevron" size={14} className="rotate-180" />
          Menu
        </button>
        <div className="page-heading">
          <h1 className="page-title">Garage</h1>
          <div className="page-sub">Tune · Paint · Upgrade</div>
        </div>
        <span className="credit-chip">
          <Icon name="credits" size={13} />
          {formatNumber(profile.credits)}
        </span>
      </header>

      <div className="page-body">
        <div className="garage-layout">
          <div className="showroom">
            <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
            <div className="showroom-overlay">
              <div className="showroom-top">
                <div>
                  <div className="showroom-class">{kart.className} Class</div>
                  <div className="showroom-name">{kart.name}</div>
                </div>
                <div className="showroom-tools">
                  <button
                    className="btn btn-icon"
                    type="button"
                    title="Reset view"
                    onClick={() => sceneRef.current?.resetView()}
                  >
                    <Icon name="refresh" size={15} />
                  </button>
                </div>
              </div>
              <div className="showroom-bottom">
                <span className="showroom-hint">Drag to rotate · Scroll to zoom</span>
                <span className="showroom-hint">{kart.tagline}</span>
              </div>
            </div>
          </div>

          <div className="garage-side">
            <Panel eyebrow="Collection" title="Karts">
              <div className="kart-list">
                {KARTS.map((k) => {
                  const isUnlocked = profile.unlockedKarts.includes(k.id);
                  return (
                    <button
                      key={k.id}
                      type="button"
                      className={`kart-tile ${k.id === kartId ? 'is-selected' : ''} ${isUnlocked ? '' : 'is-locked'}`}
                      onClick={() => onChangeKart(k.id)}
                      title={isUnlocked ? k.name : `${k.name} — ${formatNumber(k.price)} credits`}
                    >
                      <span className="kart-chip-swatch" style={{ background: k.bodyColor, width: '100%' }} />
                      <span className="kart-tile-name">{k.name}</span>
                      {!isUnlocked && <Icon name="lock" size={10} />}
                    </button>
                  );
                })}
              </div>
              {!unlocked && (
                <div className="summary-box">
                  <div className="summary-row">
                    <span>Locked</span>
                    <span>{formatNumber(kart.price)} cr</span>
                  </div>
                  <button className="btn btn-primary btn-sm" type="button" onClick={tryUnlock}>
                    <Icon name="lock" size={13} />
                    Unlock {kart.name}
                  </button>
                </div>
              )}
            </Panel>

            <Panel eyebrow="Customize" title="Visual Build">
              <div className="custom-tabs">
                {([
                  { id: 'paint', label: 'Paint' },
                  { id: 'wheels', label: 'Wheels' },
                  { id: 'decal', label: 'Decals' },
                  { id: 'details', label: 'Details' },
                  { id: 'stats', label: 'Stats' },
                ] as { id: typeof tab; label: string }[]).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`custom-tab ${tab === t.id ? 'is-active' : ''}`}
                    onClick={() => setTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {tab === 'paint' && (
                <div className="settings-rows">
                  <div>
                    <div className="control-label-text" style={{ marginBottom: 8 }}>Body Colour</div>
                    <div className="swatch-grid">
                      {PAINTS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`swatch ${customization.bodyColor === c ? 'is-selected' : ''}`}
                          style={{ background: c }}
                          onClick={() => update({ bodyColor: c })}
                          aria-label={`Body colour ${c}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="control-label-text" style={{ marginBottom: 8 }}>Helmet</div>
                    <div className="swatch-grid">
                      {HELMETS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`swatch ${customization.helmetColor === c ? 'is-selected' : ''}`}
                          style={{ background: c }}
                          onClick={() => update({ helmetColor: c })}
                          aria-label={`Helmet colour ${c}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="control-label-text" style={{ marginBottom: 8 }}>Underglow</div>
                    <div className="swatch-grid">
                      {GLOWS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`swatch ${customization.glowColor === c ? 'is-selected' : ''}`}
                          style={{ background: c, boxShadow: customization.glowColor === c ? `0 0 12px ${c}` : undefined }}
                          onClick={() => update({ glowColor: c })}
                          aria-label={`Underglow colour ${c}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {tab === 'wheels' && (
                <div className="settings-rows">
                  <div>
                    <div className="control-label-text" style={{ marginBottom: 8 }}>Tyre Colour</div>
                    <div className="swatch-grid">
                      {WHEELS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`swatch ${customization.wheelColor === c ? 'is-selected' : ''}`}
                          style={{ background: c }}
                          onClick={() => update({ wheelColor: c })}
                          aria-label={`Wheel colour ${c}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="control-label-text" style={{ marginBottom: 8 }}>Rim Colour</div>
                    <div className="swatch-grid">
                      {RIMS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`swatch ${customization.rimColor === c ? 'is-selected' : ''}`}
                          style={{ background: c }}
                          onClick={() => update({ rimColor: c })}
                          aria-label={`Rim colour ${c}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {tab === 'decal' && (
                <div className="settings-rows">
                  <div className="option-row">
                    {DECALS.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        className={`option-pill ${customization.decal === d.id ? 'is-selected' : ''}`}
                        onClick={() => update({ decal: d.id })}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <div>
                    <div className="control-label-text" style={{ marginBottom: 8 }}>Racing Number</div>
                    <input
                      className="number-input"
                      value={customization.number}
                      maxLength={3}
                      inputMode="numeric"
                      onChange={(e) => {
                        const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 3);
                        update({ number: digits || '0' });
                      }}
                      aria-label="Racing number"
                    />
                  </div>
                </div>
              )}

              {tab === 'details' && (
                <div className="settings-rows">
                  <div>
                    <div className="control-label-text" style={{ marginBottom: 8 }}>Spoiler</div>
                    <div className="option-row">
                      {SPOILERS.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className={`option-pill ${customization.spoiler === s.id ? 'is-selected' : ''}`}
                          onClick={() => update({ spoiler: s.id })}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="control-label-text" style={{ marginBottom: 8 }}>Exhaust</div>
                    <div className="option-row">
                      {EXHAUSTS.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className={`option-pill ${customization.exhaust === s.id ? 'is-selected' : ''}`}
                          onClick={() => update({ exhaust: s.id })}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="divider" />
                  <button
                    className="btn btn-secondary btn-sm"
                    type="button"
                    onClick={() => {
                      onChangeCustomization({
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
                      onToast('Reset to factory livery', 'info');
                    }}
                  >
                    <Icon name="refresh" size={13} /> Reset livery
                  </button>
                </div>
              )}

              {tab === 'stats' && (
                <div className="settings-rows">
                  <StatBars stats={kart.stats} />
                  <p className="control-hint">{kart.description}</p>
                  <div className="summary-box">
                    <div className="summary-row">
                      <span>Class</span>
                      <span>{kart.className}</span>
                    </div>
                    <div className="summary-row">
                      <span>Top Speed</span>
                      <span>{Math.round(27 * (0.78 + (kart.stats.topSpeed / 10) * 0.44) * 3.6)} km/h</span>
                    </div>
                  </div>
                </div>
              )}
            </Panel>

            <button className="btn btn-primary" type="button" onClick={onRace} style={{ marginTop: 2 }}>
              <Icon name="flag" size={15} /> Race this kart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TrackSelectScreen({
  selection,
  profile,
  onChange,
  onBack,
  onStart,
}: {
  selection: Selection;
  profile: Profile;
  onChange: (next: Partial<Selection>) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const track = TRACKS.find((t) => t.id === selection.trackId) ?? TRACKS[0];
  return (
    <div className="screen page">
      <header className="page-header">
        <button className="btn btn-ghost btn-sm" type="button" onClick={onBack}>
          <Icon name="chevron" size={14} className="rotate-180" />
          Menu
        </button>
        <div className="page-heading">
          <h1 className="page-title">Tracks</h1>
          <div className="page-sub">Six circuits · Six identities</div>
        </div>
      </header>
      <div className="page-body scroll">
        <div style={{ display: 'grid', gap: 18 }}>
          <div className="track-grid">
            {TRACKS.map((t) => {
              const played = profile.tracksPlayed.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`track-card ${selection.trackId === t.id ? 'is-selected' : ''}`}
                  onClick={() => onChange({ trackId: t.id })}
                >
                  <div
                    className="track-card-art"
                    style={{
                      background: `radial-gradient(circle at 50% 80%, ${t.palette.accent}22, transparent 70%), linear-gradient(160deg, ${t.palette.skyTop}, ${t.palette.fog})`,
                      height: 132,
                    }}
                  >
                    <TrackPreview points={t.points.map((p) => ({ x: p.x, z: p.z }))} accent={t.palette.accent} />
                    <span className="track-card-badge">{played ? 'Raced' : 'New'}</span>
                  </div>
                  <div className="track-card-body">
                    <span className="track-card-name">{t.name}</span>
                    <span className="track-card-tag">{t.tagline}</span>
                    <span className="track-card-meta">
                      <span>{t.laps} Laps</span>
                      <span className="difficulty-dots">
                        {[1, 2, 3].map((n) => (
                          <span key={n} className={`difficulty-dot ${n <= t.difficulty ? 'on' : ''}`} />
                        ))}
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <Panel eyebrow="Circuit Brief" title={track.name}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,220px) minmax(0,1fr)', gap: 18, alignItems: 'center' }}>
              <div
                style={{
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                  background: `radial-gradient(circle at 50% 70%, ${track.palette.accent}18, transparent 68%), linear-gradient(160deg, ${track.palette.skyTop}, ${track.palette.fog})`,
                  padding: 6,
                }}
              >
                <TrackPreview points={track.points.map((p) => ({ x: p.x, z: p.z }))} accent={track.palette.accent} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.65 }}>{track.description}</p>
                <div className="results-grid">
                  <div className="result-stat">
                    <span className="result-stat-label">Laps</span>
                    <span className="result-stat-value">{track.laps}</span>
                  </div>
                  <div className="result-stat">
                    <span className="result-stat-label">Checkpoints</span>
                    <span className="result-stat-value">{track.checkpointCount}</span>
                  </div>
                  <div className="result-stat">
                    <span className="result-stat-label">Boost Pads</span>
                    <span className="result-stat-value">{track.boostPads.length}</span>
                  </div>
                  <div className="result-stat">
                    <span className="result-stat-label">Record</span>
                    <span className="result-stat-value">{formatTime(profile.bestLap)}</span>
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>
      <footer className="page-footer">
        <span className="faint mono" style={{ fontSize: 10.5 }}>{track.name} selected</span>
        <button className="btn btn-primary" type="button" onClick={onStart}>
          <Icon name="play" size={15} /> Race here
        </button>
      </footer>
    </div>
  );
}

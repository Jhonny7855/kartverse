import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Customization,
  GameMode,
  GhostData,
  HudSnapshot,
  KartClassId,
  RaceConfig,
  RaceOutcome,
  RaceRewards,
  SaveData,
  Settings,
} from './data/types';
import { getKart } from './data/karts';
import { TRACKS, getTrack } from './data/tracks';
import { GameEngine } from './game/GameEngine';
import { defaultCustomization, RACER_NAMES } from './game/utils';
import { applyGrandPrixRound, applyRaceOutcome, saveGhost, unlockKart } from './game/ProgressManager';
import { clearSave, createDefaultSave, exportSave, importSave, loadSave, persistSave } from './game/storage';
import { BootSequence } from './ui/BootSequence';
import { MainMenu, type MenuRoute } from './ui/MainMenu';
import { GarageScreen, SetupScreen, TrackSelectScreen, type Selection } from './ui/Screens';
import { CareerScreen, CreditsScreen, LeaderboardScreen, SettingsScreen } from './ui/ScreensExtra';
import { ControlsGuide, PauseMenu, ResultsScreen } from './ui/Overlays';
import { DebugPanel, Hud, TouchControls } from './ui/Hud';
import { ToastStack, useToasts, TrackPreview } from './ui/Common';
import './ui/styles.css';

type Screen =
  | 'boot'
  | 'menu'
  | 'setup'
  | 'garage'
  | 'tracks'
  | 'career'
  | 'leaderboard'
  | 'settings'
  | 'credits'
  | 'race';

const GP_TRACK_IDS = ['neon-city', 'sunset-coast', 'forest-rush', 'skyline-gp'];

const CONTROLS_SEEN_KEY = 'kartverse.controlsSeen';

function hasSeenControls(): boolean {
  try {
    return localStorage.getItem(CONTROLS_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markControlsSeen(): void {
  try {
    localStorage.setItem(CONTROLS_SEEN_KEY, '1');
  } catch {
    /* storage unavailable */
  }
}

function initialSelection(save: SaveData): Selection {
  return {
    mode: 'quick',
    trackId: save.lastSelection.trackId,
    kartId: save.lastSelection.kartId,
    difficulty: save.lastSelection.difficulty,
    laps: save.lastSelection.laps,
    opponents: save.lastSelection.opponents,
  };
}

function App() {
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const [screen, setScreen] = useState<Screen>('boot');
  const [selection, setSelection] = useState<Selection>(() => initialSelection(save));
  const [raceConfig, setRaceConfig] = useState<RaceConfig | null>(null);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [outcome, setOutcome] = useState<RaceOutcome | null>(null);
  const [rewards, setRewards] = useState<RaceRewards | null>(null);
  const [paused, setPaused] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const showControlsRef = useRef(showControls);
  showControlsRef.current = showControls;
  const [loading, setLoading] = useState({ progress: 0, label: '' });
  const [debug, setDebug] = useState<{
    fps: number;
    frameMs: number;
    drawCalls: number;
    triangles: number;
    karts: number;
    bodies: number;
  } | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [settingsReturn, setSettingsReturn] = useState<Screen>('menu');
  const [raceKey, setRaceKey] = useState(0);
  const { toasts, push } = useToasts();
  const engineRef = useRef<GameEngine | null>(null);
  const gameHostRef = useRef<HTMLDivElement | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  const updateSave = useCallback((updater: (draft: SaveData) => void) => {
    setSave((prev) => {
      const draft: SaveData = JSON.parse(JSON.stringify(prev));
      updater(draft);
      persistSave(draft);
      return draft;
    });
  }, []);

  useEffect(() => {
    persistSave(save);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('reduce-motion', save.settings.reducedMotion);
    document.documentElement.style.setProperty('--ui-scale', String(save.settings.uiScale));
  }, [save.settings.reducedMotion, save.settings.uiScale]);

  const activeKart = getKart(selection.kartId);
  const customization: Customization = save.karts[selection.kartId] ?? defaultCustomization(activeKart);

  const lastMode: GameMode = useMemo(() => {
    const last = save.profile.history[save.profile.history.length - 1];
    return last?.mode ?? 'quick';
  }, [save.profile.history]);

  const handleNavigate = (route: MenuRoute) => {
    if (route === 'mode') setScreen('setup');
    else if (route === 'garage') setScreen('garage');
    else if (route === 'tracks') setScreen('tracks');
    else if (route === 'career') setScreen('career');
    else if (route === 'leaderboard') setScreen('leaderboard');
    else if (route === 'settings') {
      setSettingsReturn('menu');
      setScreen('settings');
    } else if (route === 'credits') setScreen('credits');
  };

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      updateSave((draft) => {
        draft.settings = { ...draft.settings, ...patch };
      });
      engineRef.current?.applySettings({ ...saveRef.current.settings, ...patch });
    },
    [updateSave],
  );

  const startRace = useCallback(
    (override?: Partial<Selection>) => {
      const sel = { ...selection, ...override };
      const kart = getKart(sel.kartId);
      const cust = saveRef.current.karts[sel.kartId] ?? defaultCustomization(kart);
      const config: RaceConfig = {
        mode: sel.mode,
        trackId: sel.trackId,
        kartId: sel.kartId,
        customization: cust,
        difficulty: sel.difficulty,
        opponents: sel.mode === 'timetrial' || sel.mode === 'practice' ? 0 : sel.opponents,
        laps: sel.mode === 'grandprix' ? 2 : sel.laps,
        units: saveRef.current.settings.units,
      };
      updateSave((draft) => {
        draft.lastSelection = {
          trackId: sel.trackId,
          kartId: sel.kartId,
          difficulty: sel.difficulty,
          laps: sel.laps,
          opponents: sel.opponents,
        };
      });
      setSelection(sel);
      setRaceConfig(config);
      setOutcome(null);
      setRewards(null);
      setHud(null);
      setPaused(false);
      setShowControls(!hasSeenControls());
      setScreen('race');
      setRaceKey((k) => k + 1);
    },
    [selection, updateSave],
  );

  const quickRace = () => startRace({ mode: 'quick' });

  const startGrandPrix = useCallback(() => {
    let gp = saveRef.current.grandPrix;
    if (!gp || gp.finished) {
      const aiNames = RACER_NAMES.slice(0, 5);
      gp = {
        trackIds: GP_TRACK_IDS,
        round: 0,
        standings: [
          { name: saveRef.current.profile.name, points: 0, isPlayer: true },
          ...aiNames.map((n) => ({ name: n, points: 0, isPlayer: false })),
        ],
        finished: false,
        date: Date.now(),
      };
      const nextGp = gp;
      updateSave((draft) => {
        draft.grandPrix = nextGp;
      });
    }
    const round = Math.min(gp.round, gp.trackIds.length - 1);
    const trackId = gp.trackIds[round] ?? TRACKS[0].id;
    startRace({ mode: 'grandprix', trackId, opponents: 5, laps: 2 });
  }, [startRace, updateSave]);

  const startSelected = useCallback(() => {
    if (selection.mode === 'grandprix') startGrandPrix();
    else startRace();
  }, [selection.mode, startRace, startGrandPrix]);

  useEffect(() => {
    if (screen !== 'race' || !raceConfig) return;
    const host = gameHostRef.current;
    if (!host) return;
    setLoading({ progress: 0, label: 'Starting' });
    const ghost: GhostData | null = saveRef.current.ghosts[raceConfig.trackId] ?? null;
    let engine: GameEngine | null = null;
    try {
      engine = new GameEngine(host, {
        config: raceConfig,
        settings: saveRef.current.settings,
        ghost: raceConfig.mode === 'timetrial' ? ghost : null,
        callbacks: {
          onHud: (h) => setHud(h),
          onFinish: (o) => {
            const s: SaveData = JSON.parse(JSON.stringify(saveRef.current));
            const rewardsNext = applyRaceOutcome(s, o, raceConfig.customization);
            if (o.mode === 'grandprix') applyGrandPrixRound(s, o);
            if (o.mode === 'timetrial' && o.ghost) {
              const existing = s.ghosts[o.trackId];
              if (!existing || o.ghost.time < existing.time) {
                saveGhost(s, o.trackId, o.ghost);
              }
            }
            persistSave(s);
            setSave(s);
            setRewards(rewardsNext);
            setOutcome(o);
            setPaused(false);
          },
          onLoading: (progress, label) => setLoading({ progress, label }),
          onReady: () => {
            setLoading({ progress: 1, label: 'Ready' });
            if (showControlsRef.current) engineRef.current?.setPaused(true);
          },
          onPauseChange: (p) => setPaused(p),
          onToast: (text, kind) => push(text, kind),
          onCameraChange: (label) => push(`Camera: ${label}`, 'info'),
          onDebug: (stats) => setDebug(stats),
        },
      });
      engineRef.current = engine;
      if (import.meta.env.DEV) {
        (window as unknown as Record<string, unknown>).__kartverse = engine;
      }
      void engine.load();
    } catch {
      push('WebGL is unavailable — cannot start the race', 'warn');
      setScreen('menu');
    }
    return () => {
      engine?.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, raceKey]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault();
        setShowDebug((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handlePause = useCallback(() => {
    engineRef.current?.togglePause();
  }, []);

  const handleResume = () => {
    engineRef.current?.setPaused(false);
    setPaused(false);
  };

  const handleRestart = useCallback(() => {
    const engine = engineRef.current;
    if (engine) engine.dispose();
    engineRef.current = null;
    setOutcome(null);
    setRewards(null);
    setPaused(false);
    setRaceKey((k) => k + 1);
  }, []);

  const handleQuit = useCallback(() => {
    const engine = engineRef.current;
    if (engine) engine.dispose();
    engineRef.current = null;
    setScreen('menu');
    setOutcome(null);
    setRewards(null);
    setPaused(false);
    setHud(null);
  }, []);

  const handleOutcomeNext = () => {
    if (!outcome) return;
    if (outcome.mode === 'grandprix') {
      const gp = saveRef.current.grandPrix;
      if (gp && !gp.finished) {
        const nextRound = Math.min(gp.round, gp.trackIds.length - 1);
        const trackId = gp.trackIds[nextRound];
        setSelection((prev) => ({ ...prev, mode: 'grandprix', trackId }));
        handleRestart();
        startRace({ mode: 'grandprix', trackId, opponents: 5, laps: 2 });
        return;
      }
      handleQuit();
      setScreen('career');
      return;
    }
    handleRestart();
  };

  const nextLabel = outcome
    ? outcome.mode === 'grandprix'
      ? save.grandPrix && !save.grandPrix.finished
        ? 'Next round'
        : 'Championship'
      : 'Race again'
    : 'Continue';

  const handleUnlock = (kartId: KartClassId) => {
    const def = getKart(kartId);
    const draft: SaveData = JSON.parse(JSON.stringify(saveRef.current));
    const ok = unlockKart(draft, kartId);
    if (ok) {
      persistSave(draft);
      setSave(draft);
      push(`${def.name} unlocked`, 'success');
    } else if (draft.profile.credits < def.price) {
      push(`Need ${def.price - draft.profile.credits} more credits`, 'warn');
    }
  };

  const handleResetProgress = () => {
    clearSave();
    const fresh = createDefaultSave();
    persistSave(fresh);
    setSave(fresh);
    setSelection(initialSelection(fresh));
    setScreen('menu');
    push('Progress reset', 'info');
  };

  const handleExportSave = () => {
    const blob = new Blob([exportSave(saveRef.current)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kartverse-save-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    push('Save exported', 'success');
  };

  const handleImportSave = (text: string) => {
    const imported = importSave(text);
    if (!imported) {
      push('Invalid save file', 'warn');
      return;
    }
    persistSave(imported);
    setSave(imported);
    setSelection(initialSelection(imported));
    push('Save imported', 'success');
  };

  const touchVisible = screen === 'race' && !outcome && !showControls;

  return (
    <div
      className={`app ${save.settings.highContrast ? 'high-contrast' : ''} ${
        save.settings.colorblind ? 'colorblind' : ''
      }`}
    >
      {screen === 'boot' && <BootSequence onDone={() => setScreen('menu')} />}

      {screen === 'menu' && (
        <MainMenu
          profile={save.profile}
          kart={activeKart}
          customization={customization}
          onNavigate={handleNavigate}
          onQuickRace={quickRace}
          reducedMotion={save.settings.reducedMotion}
          quality={save.settings.quality}
          lastMode={lastMode}
        />
      )}

      {screen === 'setup' && (
        <SetupScreen
          selection={selection}
          profile={save.profile}
          customization={customization}
          settings={save.settings}
          records={save.records}
          onSettingsChange={updateSettings}
          onChange={(patch) => setSelection((prev) => ({ ...prev, ...patch }))}
          onCustomizationChange={(next) =>
            updateSave((draft) => {
              draft.karts[selection.kartId] = next;
            })
          }
          onStart={startSelected}
          onBack={() => setScreen('menu')}
          onUnlock={handleUnlock}
          onNavigateGarage={() => setScreen('garage')}
        />
      )}

      {screen === 'garage' && (
        <GarageScreen
          profile={save.profile}
          customization={customization}
          settings={save.settings}
          kartId={selection.kartId}
          onChangeKart={(id) => setSelection((prev) => ({ ...prev, kartId: id }))}
          onChangeCustomization={(next) =>
            updateSave((draft) => {
              draft.karts[selection.kartId] = next;
            })
          }
          onUnlock={handleUnlock}
          onBack={() => setScreen('menu')}
          onRace={() => setScreen('setup')}
          onToast={push}
        />
      )}

      {screen === 'tracks' && (
        <TrackSelectScreen
          selection={selection}
          profile={save.profile}
          onChange={(patch) => setSelection((prev) => ({ ...prev, ...patch }))}
          onBack={() => setScreen('menu')}
          onStart={() => startRace()}
        />
      )}

      {screen === 'career' && (
        <CareerScreen
          profile={save.profile}
          save={save}
          onBack={() => setScreen('menu')}
          onStartGrandPrix={startGrandPrix}
          onResetProgress={handleResetProgress}
          onRename={(name) =>
            updateSave((draft) => {
              draft.profile.name = name.slice(0, 18) || 'PLAYER ONE';
            })
          }
        />
      )}

      {screen === 'leaderboard' && <LeaderboardScreen save={save} onBack={() => setScreen('menu')} />}

      {screen === 'settings' && (
        <SettingsScreen
          settings={save.settings}
          onChange={updateSettings}
          onBack={() => setScreen(settingsReturn)}
          onReset={handleResetProgress}
          onExport={handleExportSave}
          onImport={handleImportSave}
          onToast={push}
        />
      )}

      {screen === 'credits' && <CreditsScreen onBack={() => setScreen('menu')} />}

      {screen === 'race' && raceConfig && (
        <div className="game-root">
          <div ref={gameHostRef} style={{ position: 'absolute', inset: 0 }} />

          {loading.progress < 1 && !hud && (
            <div className="loading-screen">
              <div className="loading-top">
                <span className="logo logo-sm">
                  <span className="logo-kart">KART</span>
                  <span className="logo-verse">VERSE</span>
                </span>
                <button className="btn btn-ghost btn-sm" type="button" onClick={handleQuit}>
                  Cancel
                </button>
              </div>
              <div className="loading-center">
                <div className="loading-track-art">
                  <TrackPreview
                    points={getTrack(raceConfig.trackId).points.map((p) => ({ x: p.x, z: p.z }))}
                    accent={getTrack(raceConfig.trackId).palette.accent}
                  />
                </div>
                <div>
                  <div className="loading-title">{getTrack(raceConfig.trackId).name}</div>
                  <div className="loading-meta" style={{ marginTop: 8 }}>
                    <span>{raceConfig.mode.toUpperCase()}</span>
                    <span>{getKart(raceConfig.kartId).name}</span>
                    <span>{raceConfig.difficulty.toUpperCase()}</span>
                  </div>
                </div>
                <div className="loading-bar">
                  <div className="loading-bar-fill" style={{ width: `${Math.round(loading.progress * 100)}%` }} />
                </div>
                <div className="loading-status">
                  <span>{loading.label}</span>
                  <span>{Math.round(loading.progress * 100)}%</span>
                </div>
              </div>
              <div className="loading-bottom">
                <div className="loading-tip">
                  <strong>Tip:</strong> Hold drift while turning at speed to charge the boost meter. Release to bank it.
                </div>
                <span className="faint mono" style={{ fontSize: 10 }}>Press ESC to pause</span>
              </div>
            </div>
          )}

          {hud && !outcome && (
            <>
              <Hud hud={hud} onPause={handlePause} />
              <TouchControls
                visible={touchVisible}
                onItem={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' }))}
                onInput={(input) => engineRef.current?.setTouch(input)}
              />
            </>
          )}

          {showControls && !outcome && (
            <ControlsGuide
              onClose={() => {
                setShowControls(false);
                markControlsSeen();
                window.setTimeout(() => engineRef.current?.setPaused(false), 30);
              }}
            />
          )}

          {paused && !outcome && !showControls && (
            <PauseMenu
              onResume={handleResume}
              onRestart={handleRestart}
              onSettings={() => {
                setSettingsReturn('race');
                setScreen('settings');
              }}
              onQuit={handleQuit}
              standings={engineRef.current?.standings ?? []}
            />
          )}

          {outcome && (
            <ResultsScreen
              outcome={outcome}
              rewards={rewards}
              save={save}
              onRetry={handleRestart}
              onNext={handleOutcomeNext}
              onGarage={() => {
                handleQuit();
                setScreen('garage');
              }}
              onMenu={handleQuit}
              nextLabel={nextLabel}
            />
          )}

          {showDebug && <DebugPanel stats={debug} />}
        </div>
      )}

      <ToastStack toasts={toasts} />
    </div>
  );
}

export default App;

import { useEffect, useMemo, useRef } from 'react';
import type { HudSnapshot } from '../data/types';
import { formatTime, ordinal } from '../game/utils';
import { Icon } from './Common';

function Minimap({ hud }: { hud: HudSnapshot }) {
  const W = 150;
  const H = 108;
  const pad = 8;
  const geo = useMemo(() => {
    const pts = hud.mapTrack;
    if (pts.length < 2) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
    const spanX = Math.max(1, maxX - minX);
    const spanZ = Math.max(1, maxZ - minZ);
    const scale = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanZ);
    const ox = (W - spanX * scale) / 2;
    const oy = (H - spanZ * scale) / 2;
    const project = (p: { x: number; z: number }) => ({
      x: ox + (p.x - minX) * scale,
      y: oy + (p.z - minZ) * scale,
    });
    const path = pts
      .map((p, i) => {
        const q = project(p);
        return `${i === 0 ? 'M' : 'L'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
      })
      .join(' ') + ' Z';
    return {
      path,
      racers: hud.mapRacers.map((r) => ({ ...project(r), isPlayer: r.isPlayer, eliminated: r.eliminated })),
      start: project(hud.mapStart),
      checkpoints: hud.mapCheckpoints.map(project),
    };
  }, [hud.mapTrack, hud.mapRacers, hud.mapStart, hud.mapCheckpoints]);

  if (!geo) return <div className="hud-map" />;
  return (
    <div className="hud-map">
      <svg viewBox={`0 0 ${W} ${H}`} aria-label="Minimap">
        <path d={geo.path} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="7" strokeLinejoin="round" />
        <path d={geo.path} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.3" strokeLinejoin="round" />
        {geo.checkpoints.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="1.1" fill="rgba(255,255,255,0.26)" />
        ))}
        <circle cx={geo.start.x} cy={geo.start.y} r="2.6" fill="none" stroke="#fff" strokeWidth="1.4" />
        {geo.racers.map((r, i) =>
          r.isPlayer ? (
            <g key={i}>
              <circle cx={r.x} cy={r.y} r="4.6" fill="rgba(255,90,46,0.24)" />
              <circle cx={r.x} cy={r.y} r="2.9" fill="#ff5a2e" stroke="#fff" strokeWidth="1.1" />
            </g>
          ) : (
            <circle
              key={i}
              cx={r.x}
              cy={r.y}
              r="2"
              fill={r.eliminated ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.62)'}
            />
          ),
        )}
      </svg>
    </div>
  );
}

export function Hud({ hud, onPause }: { hud: HudSnapshot; onPause: () => void }) {
  const posSuffix = ordinal(hud.position).replace(/\d/g, '');
  const speedPct = Math.min(1, hud.speed / hud.speedLimit);
  const speedClass = speedPct > 0.92 ? 'is-max' : speedPct > 0.7 ? 'is-fast' : '';
  const countdownValue = hud.state === 'countdown' ? Math.ceil(hud.countdown - 0.001) : 0;
  const showGo = hud.state === 'racing' && hud.countdown > 0.02;
  const boostPct = Math.min(100, hud.boost);
  const driftPct = hud.drift * 100;

  return (
    <div className="hud">
      <div className="hud-corner hud-tl">
        <div className="hud-card hud-pos">
          <span className="hud-pos-num">{hud.position}</span>
          <span className="hud-pos-suffix">{posSuffix}</span>
          <span className="hud-pos-total">/{hud.totalRacers}</span>
        </div>
        <div className="hud-card hud-lap">
          <span className="hud-lap-label">{hud.mode === 'practice' ? 'Free' : 'Lap'}</span>
          <span className="hud-lap-value">
            {hud.mode === 'practice' ? (
              'RUN'
            ) : (
              <>
                {Math.min(hud.lap, hud.totalLaps)}
                <span> / {hud.totalLaps}</span>
              </>
            )}
          </span>
        </div>
      </div>

      <div className="hud-corner hud-tc">
        {hud.state === 'countdown' && countdownValue > 0 && (
          <div className="hud-center-msg">
            <div className="countdown" key={countdownValue}>{countdownValue}</div>
            <div className="hud-camera">{hud.trackName}</div>
          </div>
        )}
        {showGo && <div className="countdown is-go" key="go">GO</div>}
        {hud.wrongWay && <div className="hud-alert">Wrong Way</div>}
        {hud.eliminationIn !== null && hud.eliminationIn < 6.5 && hud.state === 'racing' && (
          <div className={`hud-elim ${hud.eliminationIn < 3 ? 'is-critical' : ''}`}>
            Elimination in {Math.ceil(hud.eliminationIn)}s
          </div>
        )}
      </div>

      <div className="hud-corner hud-tr">
        <div className="hud-card hud-timing">
          <div className="hud-timing-item">
            <span className="hud-timing-label">Race</span>
            <span className="hud-timing-value">{formatTime(hud.raceTime)}</span>
          </div>
          <div className="hud-timing-item">
            <span className="hud-timing-label">Lap</span>
            <span className="hud-timing-value is-current">{formatTime(hud.currentLapTime)}</span>
          </div>
          <div className="hud-timing-item">
            <span className="hud-timing-label">Best</span>
            <span className="hud-timing-value is-best">{formatTime(hud.bestLap)}</span>
          </div>
          <div className="hud-timing-item">
            <span className="hud-timing-label">Last</span>
            <span className="hud-timing-value">{formatTime(hud.lastLap)}</span>
          </div>
        </div>
        {hud.shieldTime > 0 && (
          <div className="hud-shield">
            <Icon name="star" size={11} /> Shield {hud.shieldTime.toFixed(1)}s
          </div>
        )}
      </div>

      <div className="hud-corner hud-bl">
        <Minimap hud={hud} />
        <span className="hud-camera">{hud.cameraMode}</span>
      </div>

      <div className="hud-corner hud-bc">
        {hud.item && (
          <div className="hud-item" key={hud.item}>
            <Icon name="bolt" size={12} />
            {hud.item}
            <span className="hud-item-key">F</span>
          </div>
        )}
        <div className="hud-meters">
          <div className="hud-card hud-meter">
            <div className="hud-meter-head">
              <span className="hud-meter-label">
                <Icon name="bolt" size={9} /> Boost
              </span>
              <span className="hud-meter-val">{Math.round(boostPct)}%</span>
            </div>
            <div className="hud-meter-track">
              <div
                className={`hud-meter-fill boost ${hud.boosting ? 'is-active' : ''}`}
                style={{ width: `${boostPct}%` }}
              />
            </div>
          </div>
          <div className="hud-card hud-meter">
            <div className="hud-meter-head">
              <span className="hud-meter-label">
                <Icon name="drift" size={9} /> Drift
              </span>
              <span className="hud-meter-val">{hud.drifting ? 'ACTIVE' : `${Math.round(driftPct)}%`}</span>
            </div>
            <div className="hud-meter-track">
              <div
                className={`hud-meter-fill drift ${hud.drifting ? 'is-active' : ''}`}
                style={{ width: `${hud.drifting ? 100 : driftPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="hud-corner hud-br">
        <div className="hud-card hud-speedo">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span className={`hud-speed-value ${speedClass}`}>{hud.speed}</span>
            <div className="hud-rpm">
              <div className="hud-rpm-fill" style={{ width: `${Math.min(100, hud.rpm * 100)}%` }} />
            </div>
          </div>
          <div className="hud-gear">
            <span className="hud-gear-num">{hud.gear === 0 ? 'N' : hud.gear}</span>
            <span className="hud-gear-label">GEAR</span>
          </div>
          <span className="hud-speed-unit">{hud.speedUnit === 'mph' ? 'mph' : 'km/h'}</span>
        </div>
      </div>

      <button
        type="button"
        className="hud-pause-btn"
        onClick={onPause}
        aria-label="Pause race"
        style={{ display: 'grid' }}
      >
        <Icon name="pause" size={16} />
      </button>
    </div>
  );
}

export function DebugPanel({
  stats,
}: {
  stats: { fps: number; frameMs: number; drawCalls: number; triangles: number; karts: number; bodies: number } | null;
}) {
  if (!stats) return null;
  return (
    <div className="debug-panel">
      <span className="debug-item">FPS <strong>{stats.fps.toFixed(0)}</strong></span>
      <span className="debug-item">FRAME <strong>{stats.frameMs.toFixed(1)}ms</strong></span>
      <span className="debug-item">DRAWS <strong>{stats.drawCalls}</strong></span>
      <span className="debug-item">TRIS <strong>{(stats.triangles / 1000).toFixed(0)}k</strong></span>
      <span className="debug-item">KARTS <strong>{stats.karts}</strong></span>
      <span className="debug-item">BODIES <strong>{stats.bodies}</strong></span>
    </div>
  );
}

export function TouchControls({
  onInput,
  onItem,
  visible,
}: {
  onInput: (input: { steer?: number; throttle?: number; brake?: number; drift?: boolean; boost?: boolean }) => void;
  onItem: () => void;
  visible: boolean;
}) {
  const state = useRef({ left: false, right: false, throttle: false, brake: false, drift: false, boost: false });
  useEffect(() => {
    if (!visible) return;
    return () => {
      onInput({ steer: 0, throttle: 0, brake: 0, drift: false, boost: false });
    };
  }, [visible, onInput]);

  const push = () => {
    const s = state.current;
    onInput({
      steer: (s.left ? 1 : 0) - (s.right ? 1 : 0),
      throttle: s.throttle ? 1 : 0,
      brake: s.brake ? 1 : 0,
      drift: s.drift,
      boost: s.boost,
    });
  };

  const bind = (key: keyof typeof state.current) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      state.current[key] = true;
      (e.currentTarget as HTMLElement).classList.add('is-active');
      push();
    },
    onPointerUp: (e: React.PointerEvent) => {
      state.current[key] = false;
      (e.currentTarget as HTMLElement).classList.remove('is-active');
      push();
    },
    onPointerCancel: (e: React.PointerEvent) => {
      state.current[key] = false;
      (e.currentTarget as HTMLElement).classList.remove('is-active');
      push();
    },
    onPointerLeave: (e: React.PointerEvent) => {
      if (!(e.buttons & 1)) return;
      state.current[key] = false;
      (e.currentTarget as HTMLElement).classList.remove('is-active');
      push();
    },
  });

  if (!visible) return null;
  return (
    <div className="touch-controls">
      <div className="touch-steer">
        <button type="button" className="touch-pad" {...bind('left')} aria-label="Steer left">
          <Icon name="chevron" size={20} className="rotate-180" />
        </button>
        <button type="button" className="touch-pad" {...bind('right')} aria-label="Steer right">
          <Icon name="chevron" size={20} />
        </button>
      </div>
      <div className="touch-actions">
        <div className="touch-row">
          <button type="button" className="touch-action" {...bind('drift')} aria-label="Drift">
            DRIFT
          </button>
          <button type="button" className="touch-action is-boost" {...bind('boost')} aria-label="Boost">
            BOOST
          </button>
        </div>
        <div className="touch-row">
          <button type="button" className="touch-action" {...bind('brake')} aria-label="Brake">
            BRAKE
          </button>
          <button
            type="button"
            className="touch-action is-throttle"
            {...bind('throttle')}
            aria-label="Accelerate"
          >
            <Icon name="play" size={22} />
          </button>
        </div>
        <button type="button" className="touch-action" onPointerDown={onItem} aria-label="Use item" style={{ width: 54, height: 54 }}>
          ITEM
        </button>
      </div>
    </div>
  );
}

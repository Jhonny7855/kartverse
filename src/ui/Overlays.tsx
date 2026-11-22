import type { RaceOutcome, RaceRewards, RacerStanding, SaveData } from '../data/types';
import { getKart } from '../data/karts';
import { formatNumber, formatTime, MODE_LABELS, ordinal } from '../game/utils';
import { Icon } from './Common';

export function ResultsScreen({
  outcome,
  rewards,
  save,
  onRetry,
  onNext,
  onGarage,
  onMenu,
  nextLabel,
}: {
  outcome: RaceOutcome;
  rewards: RaceRewards | null;
  save: SaveData;
  onRetry: () => void;
  onNext: () => void;
  onGarage: () => void;
  onMenu: () => void;
  nextLabel: string;
}) {
  const won = outcome.position === 1 && !outcome.eliminated;
  const solo = outcome.mode === 'timetrial' || outcome.mode === 'practice';
  const record = save.records[outcome.trackId]?.[0];
  const isRecord = Boolean(outcome.bestLap && record && Math.abs(record.time - outcome.bestLap) < 0.0005);

  return (
    <div className="overlay">
      <div className="modal modal-xl" style={{ maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div className="modal-sub">
              {MODE_LABELS[outcome.mode]} · {outcome.trackName} · {outcome.laps} laps
            </div>
            <h2 className="modal-title" style={{ marginTop: 6 }}>
              {outcome.eliminated ? 'Eliminated' : won ? 'Victory' : solo ? 'Session Complete' : 'Race Complete'}
            </h2>
          </div>
          {rewards && (
            <div className="reward-row">
              <span className="reward-chip xp">
                <Icon name="bolt" size={13} /> +{rewards.xp} XP
              </span>
              <span className="reward-chip">
                <Icon name="credits" size={13} /> +{formatNumber(rewards.credits)}
              </span>
              {rewards.levelUp && (
                <span className="reward-chip xp">
                  <Icon name="star" size={13} /> Level {rewards.newLevel}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="results-layout">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className={`results-position ${won ? 'is-win' : ''}`}>
              <span className="results-pos-num">{outcome.eliminated ? '—' : outcome.position}</span>
              <span className="results-pos-label">
                {outcome.eliminated ? 'Eliminated' : `of ${outcome.totalRacers} · ${ordinal(outcome.position)}`}
              </span>
            </div>
            <div className="results-grid">
              <div className="result-stat">
                <span className="result-stat-label">Total Time</span>
                <span className="result-stat-value">{formatTime(outcome.totalTime)}</span>
              </div>
              <div className="result-stat">
                <span className="result-stat-label">Best Lap</span>
                <span className="result-stat-value" style={{ color: isRecord ? 'var(--yellow)' : undefined }}>
                  {formatTime(outcome.bestLap)}
                </span>
              </div>
              <div className="result-stat">
                <span className="result-stat-label">Top Speed</span>
                <span className="result-stat-value">{Math.round(outcome.topSpeed * 3.6)}</span>
              </div>
              <div className="result-stat">
                <span className="result-stat-label">Drift Score</span>
                <span className="result-stat-value">{formatNumber(outcome.driftScore)}</span>
              </div>
              <div className="result-stat">
                <span className="result-stat-label">Clean</span>
                <span className="result-stat-value" style={{ color: outcome.cleanRace ? 'var(--green)' : undefined }}>
                  {outcome.cleanRace ? 'YES' : 'NO'}
                </span>
              </div>
              <div className="result-stat">
                <span className="result-stat-label">Boosts</span>
                <span className="result-stat-value">{outcome.boostUses}</span>
              </div>
            </div>
            {isRecord && (
              <div className="reward-chip" style={{ justifyContent: 'center' }}>
                <Icon name="trophy" size={13} /> New track lap record
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            {outcome.standings.length > 1 ? (
              <div>
                <div className="eyebrow">Final Classification</div>
                <table className="standings-table">
                  <thead>
                    <tr>
                      <th>Pos</th>
                      <th>Racer</th>
                      <th>Kart</th>
                      <th>Best Lap</th>
                      <th>Gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outcome.standings.map((s: RacerStanding) => (
                      <tr key={s.name} className={`${s.isPlayer ? 'is-player' : ''} ${s.eliminated ? 'is-out' : ''}`}>
                        <td className="standings-pos">{s.position}</td>
                        <td>{s.name}</td>
                        <td className="standings-kart">{getKart(s.kartId).name}</td>
                        <td className="mono" style={{ fontSize: 11 }}>{formatTime(s.bestLap)}</td>
                        <td className="mono" style={{ fontSize: 11 }}>{s.eliminated ? 'OUT' : s.gap}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="summary-box">
                <div className="eyebrow">Solo Session</div>
                <p className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
                  {outcome.mode === 'timetrial'
                    ? 'Ghost data is saved for your fastest lap. Retry to chase the delta.'
                    : 'Free practice complete. Explore the circuit, learn the drift zones, then take it to a race.'}
                </p>
              </div>
            )}

            {rewards && rewards.achievements.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div className="eyebrow">Achievements Unlocked</div>
                {rewards.achievements.map((a) => (
                  <div className="achievement-toast" key={a.def.id}>
                    <span className="achievement-toast-icon">
                      <Icon name="trophy" size={18} />
                    </span>
                    <div>
                      <div className="achievement-toast-name">{a.def.name}</div>
                      <div className="achievement-toast-desc">{a.def.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" type="button" onClick={onMenu}>
            <Icon name="home" size={14} /> Menu
          </button>
          <button className="btn btn-secondary" type="button" onClick={onGarage}>
            <Icon name="garage" size={14} /> Garage
          </button>
          <button className="btn btn-secondary" type="button" onClick={onRetry}>
            <Icon name="refresh" size={14} /> Retry
          </button>
          <button className="btn btn-primary" type="button" onClick={onNext}>
            <Icon name="arrow" size={14} /> {nextLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PauseMenu({
  onResume,
  onRestart,
  onSettings,
  onQuit,
  standings,
}: {
  onResume: () => void;
  onRestart: () => void;
  onSettings: () => void;
  onQuit: () => void;
  standings: RacerStanding[];
}) {
  return (
    <div className="overlay">
      <div className="modal" style={{ width: 'min(460px, 100%)' }}>
        <div>
          <div className="modal-sub">Race Paused</div>
          <h2 className="modal-title" style={{ marginTop: 6 }}>Standby</h2>
        </div>
        {standings.length > 1 && (
          <div className="summary-box">
            {standings.slice(0, 4).map((s) => (
              <div className="summary-row" key={s.name}>
                <span>{s.position}. {s.name}</span>
                <span className="mono">{s.eliminated ? 'OUT' : s.gap}</span>
              </div>
            ))}
          </div>
        )}
        <div className="modal-actions stretch" style={{ flexDirection: 'column' }}>
          <button className="btn btn-primary" type="button" onClick={onResume}>
            <Icon name="play" size={15} /> Resume
          </button>
          <button className="btn btn-secondary" type="button" onClick={onRestart}>
            <Icon name="refresh" size={14} /> Restart race
          </button>
          <button className="btn btn-secondary" type="button" onClick={onSettings}>
            <Icon name="settings" size={14} /> Settings
          </button>
          <button className="btn btn-ghost" type="button" onClick={onQuit}>
            <Icon name="close" size={14} /> Quit to menu
          </button>
        </div>
      </div>
    </div>
  );
}

export function ControlsGuide({ onClose }: { onClose: () => void }) {
  const rows: { key: string; desc: string }[] = [
    { key: 'W / ↑', desc: 'Accelerate' },
    { key: 'S / ↓', desc: 'Brake & reverse' },
    { key: 'A / ←', desc: 'Steer left' },
    { key: 'D / →', desc: 'Steer right' },
    { key: 'SPACE', desc: 'Drift / handbrake' },
    { key: 'SHIFT', desc: 'Boost' },
    { key: 'F', desc: 'Use item' },
    { key: 'C', desc: 'Change camera' },
    { key: 'R', desc: 'Recover kart' },
    { key: 'ESC', desc: 'Pause' },
  ];
  return (
    <div className="overlay">
      <div className="modal" style={{ width: 'min(560px, 100%)' }}>
        <div>
          <div className="modal-sub">Before you launch</div>
          <h2 className="modal-title" style={{ marginTop: 6 }}>Race Controls</h2>
        </div>
        <div className="controls-grid">
          {rows.map((r) => (
            <div className="key-row" key={r.key}>
              <span className="keycap">{r.key}</span>
              <span className="key-desc">{r.desc}</span>
            </div>
          ))}
        </div>
        <p className="control-hint">
          Drift to charge boost: hold drift while turning at speed. Release to bank the reward.
          Boost pads on track refill the meter instantly.
        </p>
        <div className="modal-actions">
          <button className="btn btn-primary" type="button" onClick={onClose}>
            <Icon name="check" size={15} /> Got it
          </button>
        </div>
      </div>
    </div>
  );
}

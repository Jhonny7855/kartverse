import { useEffect, useRef, useState } from 'react';
import { Logo } from './Common';

const BOOT_LINES = [
  'Initialising render pipeline',
  'Loading shader library',
  'Calibrating race control',
  'Warming tyre compounds',
  'Syncing grid telemetry',
];

export function BootSequence({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [line, setLine] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    const start = performance.now();
    const duration = 2300;
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(eased * 100);
      setLine(Math.min(BOOT_LINES.length - 1, Math.floor(eased * BOOT_LINES.length)));
      if (t < 1) raf = requestAnimationFrame(tick);
      else if (!doneRef.current) {
        doneRef.current = true;
        window.setTimeout(onDone, 320);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return (
    <div className="boot">
      <div className="boot-inner">
        <div className="boot-logo">
          <Logo size="lg" />
        </div>
        <div className="boot-tag">Arcade Racing Protocol</div>
        <div className="boot-bar">
          <div className="boot-bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="boot-status">
          <span>{BOOT_LINES[line]}</span>
          <span>{Math.round(progress).toString().padStart(3, '0')}%</span>
        </div>
        <button className="boot-skip" type="button" onClick={onDone}>
          Skip intro
        </button>
      </div>
    </div>
  );
}

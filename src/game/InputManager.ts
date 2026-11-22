import type { KeyBindings, TouchInput } from '../data/types';
import type { KartInput } from './RacePhysics';
import { clamp } from './utils';

export type GameCommand = 'pause' | 'camera' | 'reset' | 'item';

export class InputManager {
  private keys = new Set<string>();
  private bindings: KeyBindings;
  private enabled = true;
  private touch: TouchInput = { steer: 0, throttle: 0, brake: 0, drift: false, boost: false };
  private lastSteer = 0;
  private onCommand: (command: GameCommand) => void;
  private handlers: {
    down: (e: KeyboardEvent) => void;
    up: (e: KeyboardEvent) => void;
    blur: () => void;
  };

  constructor(bindings: KeyBindings, onCommand: (command: GameCommand) => void) {
    this.bindings = bindings;
    this.onCommand = onCommand;

    this.handlers = {
      down: (e: KeyboardEvent) => {
        if (!this.enabled) return;
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        const code = e.code;
        if (this.isGameKey(code)) e.preventDefault();
        this.keys.add(code);

        if (code === this.bindings.pause) this.onCommand('pause');
        if (code === this.bindings.camera) this.onCommand('camera');
        if (code === this.bindings.reset) this.onCommand('reset');
        if (code === this.bindings.item) this.onCommand('item');
      },
      up: (e: KeyboardEvent) => {
        this.keys.delete(e.code);
      },
      blur: () => {
        this.keys.clear();
      },
    };
    window.addEventListener('keydown', this.handlers.down);
    window.addEventListener('keyup', this.handlers.up);
    window.addEventListener('blur', this.handlers.blur);
  }

  private isGameKey(code: string): boolean {
    const b = this.bindings;
    return [
      b.accelerate,
      b.brake,
      b.left,
      b.right,
      b.drift,
      b.boost,
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Space',
    ].includes(code);
  }

  setBindings(bindings: KeyBindings) {
    this.bindings = bindings;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.keys.clear();
  }

  setTouch(input: Partial<TouchInput>) {
    this.touch = { ...this.touch, ...input };
  }

  clearTouch() {
    this.touch = { steer: 0, throttle: 0, brake: 0, drift: false, boost: false };
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  getInput(): KartInput {
    if (!this.enabled) {
      return { throttle: 0, brake: 0, steer: 0, drift: false, boost: false };
    }
    const b = this.bindings;
    const throttle = this.isDown(b.accelerate) || this.isDown('ArrowUp') ? 1 : 0;
    const brake = this.isDown(b.brake) || this.isDown('ArrowDown') ? 1 : 0;
    const left = this.isDown(b.left) || this.isDown('ArrowLeft') ? 1 : 0;
    const right = this.isDown(b.right) || this.isDown('ArrowRight') ? 1 : 0;
    let steer = right - left;
    steer += this.touch.steer;
    steer = clamp(steer, -1, 1);
    // Digital keyboard input gets smoothed here so physics stays smooth too.
    const smoothing = steer === 0 ? 0.55 : 0.34;
    this.lastSteer += (steer - this.lastSteer) * smoothing;
    if (Math.abs(this.lastSteer) < 0.001) this.lastSteer = 0;
    return {
      throttle: Math.max(throttle, this.touch.throttle),
      brake: Math.max(brake, this.touch.brake),
      steer: this.lastSteer,
      drift: this.isDown(b.drift) || this.isDown('Space') || this.touch.drift,
      boost:
        this.isDown(b.boost) ||
        this.isDown('ShiftRight') ||
        this.touch.boost,
    };
  }

  get rawSteer(): number {
    const b = this.bindings;
    const left = this.isDown(b.left) || this.isDown('ArrowLeft') ? 1 : 0;
    const right = this.isDown(b.right) || this.isDown('ArrowRight') ? 1 : 0;
    return clamp(right - left + this.touch.steer, -1, 1);
  }

  dispose() {
    window.removeEventListener('keydown', this.handlers.down);
    window.removeEventListener('keyup', this.handlers.up);
    window.removeEventListener('blur', this.handlers.blur);
  }
}

import * as THREE from 'three';
import type { PartRuntime } from '../types';

export type AnimMode = 'rest' | 'grid';

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class BodyAnimator {
  private mode: AnimMode = 'rest';
  private duration = 2.2;
  private fromPositions: THREE.Vector3[] = [];
  private toPositions: THREE.Vector3[] = [];
  private fromScales: number[] = [];
  private toScales: number[] = [];
  private active: boolean[] = [];
  private delays: number[] = [];
  private partDuration = 1.0;
  private liftAmount = 0.08;
  private startTime = 0;
  private running = false;
  private tmp = new THREE.Vector3();
  private runtimes: PartRuntime[];

  constructor(runtimes: PartRuntime[]) {
    this.runtimes = runtimes;
    this.fromPositions = runtimes.map((r) => r.restPosition.clone());
    this.toPositions = runtimes.map((r) => r.restPosition.clone());
    this.fromScales = runtimes.map(() => 1);
    this.toScales = runtimes.map(() => 1);
    this.active = runtimes.map(() => false);
    this.delays = runtimes.map(() => 0);
  }

  get currentMode(): AnimMode {
    return this.mode;
  }

  get isAnimating(): boolean {
    return this.running;
  }

  private captureFrom(): void {
    this.fromPositions = this.runtimes.map((r) => r.mesh.position.clone());
    this.fromScales = this.runtimes.map((r) => r.mesh.scale.x);
  }

  /**
   * Animate toward precomputed alignTarget / restPosition (and alignScale / 1).
   * Only indices in `indices` (or all if omitted) participate; others stay put.
   */
  private startTween(
    mode: AnimMode,
    getTarget: (r: PartRuntime, i: number) => THREE.Vector3,
    getScale: (r: PartRuntime, i: number) => number,
    indices: number[] | null,
    opts?: { duration?: number; lift?: number },
  ): void {
    this.captureFrom();
    const n = this.runtimes.length;
    this.active = new Array(n).fill(false);
    this.delays = new Array(n).fill(0);
    this.toPositions = this.runtimes.map((r) => r.mesh.position.clone());
    this.toScales = this.runtimes.map((r) => r.mesh.scale.x);

    const list = indices ?? this.runtimes.map((_, i) => i);
    for (const i of list) {
      this.active[i] = true;
      this.toPositions[i] = getTarget(this.runtimes[i], i).clone();
      this.toScales[i] = getScale(this.runtimes[i], i);
    }

    const count = list.length;
    const totalDuration =
      opts?.duration ??
      Math.min(2.5, Math.max(1.6, 1.4 + Math.log10(Math.max(2, count)) * 0.45));
    this.duration = totalDuration;
    const maxStagger = Math.min(1.35, totalDuration * 0.55);
    this.partDuration = Math.max(0.75, totalDuration - maxStagger * 0.85);
    this.liftAmount = opts?.lift ?? 0.07;

    for (let k = 0; k < list.length; k++) {
      const i = list[k];
      const t = count <= 1 ? 0 : k / (count - 1);
      this.delays[i] = t * maxStagger;
    }

    this.mode = mode;
    this.startTime = performance.now();
    this.running = true;
  }

  /** Align visible parts into their alignTarget grid slots (call after targets are set). */
  allinea(indices: number[], opts?: { duration?: number; lift?: number }): void {
    this.startTween(
      'grid',
      (r) => r.alignTarget,
      (r) => r.alignScale,
      indices,
      { lift: opts?.lift ?? 0.09, duration: opts?.duration },
    );
  }

  recomponi(indices?: number[] | null): void {
    this.startTween(
      'rest',
      (r) => r.restPosition,
      () => 1,
      indices ?? null,
      { lift: 0.06 },
    );
  }

  update(): void {
    if (!this.running) return;
    const elapsed = (performance.now() - this.startTime) / 1000;
    const n = this.runtimes.length;
    let allDone = true;

    for (let i = 0; i < n; i++) {
      if (!this.active[i]) continue;
      const local = (elapsed - this.delays[i]) / this.partDuration;
      const clamped = Math.min(1, Math.max(0, local));
      if (clamped < 1) allDone = false;

      const t = this.mode === 'grid' ? easeOutCubic(clamped) : easeInOutCubic(clamped);
      this.tmp.lerpVectors(this.fromPositions[i], this.toPositions[i], t);

      const arc = Math.sin(Math.PI * clamped);
      this.tmp.y += this.liftAmount * arc;

      this.runtimes[i].mesh.position.copy(this.tmp);
      const s = this.fromScales[i] + (this.toScales[i] - this.fromScales[i]) * t;
      this.runtimes[i].mesh.scale.setScalar(s);
    }

    if (allDone || elapsed > this.duration + 0.35) {
      for (let i = 0; i < n; i++) {
        if (!this.active[i]) continue;
        this.runtimes[i].mesh.position.copy(this.toPositions[i]);
        this.runtimes[i].mesh.scale.setScalar(this.toScales[i]);
      }
      this.running = false;
    }
  }
}

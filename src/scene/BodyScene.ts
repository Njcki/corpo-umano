import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createBodyGroup, disposeBodyGroup, setPartHighlight } from './BodyBuilder';
import { BodyAnimator } from './animations';
import { SYSTEMS } from '../data/systems';
import type { AnatomyCatalog, AnatomyPart, PartRuntime, SystemId } from '../types';

export type DetailCallback = (
  part: AnatomyPart | null,
  clientX: number,
  clientY: number,
  opts?: { selected?: boolean },
) => void;

export type ExamineMode = 'nel-corpo' | 'solo';
export type ExamineChangeCallback = (
  state: {
    active: boolean;
    mode: ExamineMode;
    part: AnatomyPart | null;
    related: AnatomyPart[];
  },
) => void;

interface MeshMaterialSnapshot {
  mesh: THREE.Mesh;
  material: THREE.Material | THREE.Material[];
  visible: boolean;
}

export type UiTheme = 'dark' | 'light';

const THEME_SCENE = {
  dark: {
    bg: 0x0b1220,
    fogDensity: 0.028,
    ambient: { color: 0x9eb0cc, intensity: 0.55 },
    key: { color: 0xffffff, intensity: 1.25 },
    rim: { color: 0x66cfff, intensity: 0.45 },
    fill: { color: 0xffc9a8, intensity: 0.3 },
    hemiSky: 0xc8daf0,
    hemiGround: 0x1a1520,
    hemiIntensity: 0.35,
    ground: 0x121a2a,
    groundOpacity: 0.65,
    exposure: 1.05,
  },
  light: {
    bg: 0xd8e4f0,
    fogDensity: 0.018,
    ambient: { color: 0xffffff, intensity: 0.72 },
    key: { color: 0xfff8f0, intensity: 1.35 },
    rim: { color: 0x4aa8d8, intensity: 0.38 },
    fill: { color: 0xffe0c8, intensity: 0.42 },
    hemiSky: 0xf0f6ff,
    hemiGround: 0xc8b8a8,
    hemiIntensity: 0.48,
    ground: 0xc5d0e0,
    groundOpacity: 0.55,
    exposure: 1.12,
  },
} as const;

const SYSTEM_ORDER: Record<string, number> = Object.fromEntries(
  SYSTEMS.map((s, i) => [s.id, i]),
);

/** Screen px before a press is treated as orbit/pan drag instead of a tap-select. */
const TAP_MOVE_THRESHOLD_MOUSE = 7;
const TAP_MOVE_THRESHOLD_TOUCH = 10;

export class BodyScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  runtimes: PartRuntime[] = [];
  animator!: BodyAnimator;
  meshToIndex: Map<THREE.Mesh, number> = new Map();

  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  /** Shared unit sphere for invisible pick helpers (not rendered). */
  private pickHelperGeo = new THREE.SphereGeometry(1, 10, 8);
  private pickHelperMat = new THREE.MeshBasicMaterial({ visible: false });
  private visibleSystems = new Set<SystemId>();
  private searchQuery = '';
  private hovered: PartRuntime | null = null;
  private selected: PartRuntime | null = null;
  private onDetail: DetailCallback;
  private onExamineChange: ExamineChangeCallback | null = null;
  private examining = false;
  private examineRuntime: PartRuntime | null = null;
  private examineMode: ExamineMode = 'nel-corpo';
  private examineSnapshots: MeshMaterialSnapshot[] = [];
  private examineClones: THREE.Material[] = [];
  private clock = new THREE.Clock();
  private raf = 0;
  private bodyGroup: THREE.Group | null = null;
  private disposed = false;
  private canvas: HTMLCanvasElement;
  private ambientLight!: THREE.AmbientLight;
  private keyLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;
  private fillLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private ground!: THREE.Mesh;
  private baseFogDensity = 0.028;

  private camAnimating = false;
  private camStartPos = new THREE.Vector3();
  private camEndPos = new THREE.Vector3();
  private camStartTarget = new THREE.Vector3();
  private camEndTarget = new THREE.Vector3();
  private camStartTime = 0;
  private camDuration = 1.8;

  /** Tap vs drag: defer selection until pointerup with little movement. */
  private gesturePointerId: number | null = null;
  private gestureStartX = 0;
  private gestureStartY = 0;
  private gestureIsDrag = false;
  private gestureSelectArmed = false;
  private pendingSelect: PartRuntime | null = null;
  private activePointers = new Set<number>();

  /** Shared no-op raycast (avoid per-call arrow allocations). */
  private static readonly NO_RAYCAST = (): void => {};

  /** Pause RAF while the tab is hidden (harmless perf keep). */
  private pageHidden = false;
  private _tmpWorldBox = new THREE.Box3();
  private _camDir = new THREE.Vector3();
  private _lookTarget = new THREE.Vector3();
  private _pickMeshes: THREE.Object3D[] = [];
  private _pickHelpers: THREE.Object3D[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    onDetail: DetailCallback,
    allSystems: SystemId[],
  ) {
    this.canvas = canvas;
    this.onDetail = onDetail;
    allSystems.forEach((s) => this.visibleSystems.add(s));

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(THEME_SCENE.dark.bg);
    this.scene.fog = new THREE.FogExp2(THEME_SCENE.dark.bg, THEME_SCENE.dark.fogDensity);
    this.baseFogDensity = THEME_SCENE.dark.fogDensity;

    this.camera = new THREE.PerspectiveCamera(
      42,
      canvas.clientWidth / Math.max(1, canvas.clientHeight),
      0.05,
      100,
    );
    this.camera.position.set(1.15, 1.15, 2.35);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 0.95, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 14;
    this.controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    this.ambientLight = new THREE.AmbientLight(
      THEME_SCENE.dark.ambient.color,
      THEME_SCENE.dark.ambient.intensity,
    );
    this.scene.add(this.ambientLight);

    this.keyLight = new THREE.DirectionalLight(
      THEME_SCENE.dark.key.color,
      THEME_SCENE.dark.key.intensity,
    );
    this.keyLight.position.set(2.8, 4.2, 2.4);
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(
      THEME_SCENE.dark.rim.color,
      THEME_SCENE.dark.rim.intensity,
    );
    this.rimLight.position.set(-3.2, 2.2, -2.4);
    this.scene.add(this.rimLight);

    this.fillLight = new THREE.DirectionalLight(
      THEME_SCENE.dark.fill.color,
      THEME_SCENE.dark.fill.intensity,
    );
    this.fillLight.position.set(0.2, -0.5, 2.5);
    this.scene.add(this.fillLight);

    this.hemiLight = new THREE.HemisphereLight(
      THEME_SCENE.dark.hemiSky,
      THEME_SCENE.dark.hemiGround,
      THEME_SCENE.dark.hemiIntensity,
    );
    this.scene.add(this.hemiLight);

    this.ground = new THREE.Mesh(
      new THREE.CircleGeometry(1.35, 64),
      new THREE.MeshStandardMaterial({
        color: THEME_SCENE.dark.ground,
        roughness: 0.92,
        metalness: 0.08,
        transparent: true,
        opacity: THEME_SCENE.dark.groundOpacity,
      }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = 0;
    this.scene.add(this.ground);

    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('lostpointercapture', this.onPointerUp);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    this.animate();
  }

  private onVisibilityChange = (): void => {
    if (document.hidden) {
      this.pageHidden = true;
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      return;
    }
    this.pageHidden = false;
    if (!this.disposed && !this.raf) {
      this.raf = requestAnimationFrame(this.animate);
    }
  };

  async loadBody(
    catalog: AnatomyCatalog,
    onProgress?: (fraction: number, label: string) => void,
  ): Promise<void> {
    this.exitExamine(false);
    this.hovered = null;
    this.selected = null;
    this.onDetail(null, 0, 0);
    if (this.bodyGroup) {
      this.clearPickHelpers();
      this.scene.remove(this.bodyGroup);
      disposeBodyGroup(this.bodyGroup);
      this.bodyGroup = null;
    }
    this.runtimes = [];
    this.meshToIndex = new Map();

    const { group, runtimes, meshToIndex } = await createBodyGroup(catalog, onProgress);
    this.bodyGroup = group;
    this.runtimes = runtimes;
    this.meshToIndex = meshToIndex;
    this.animator = new BodyAnimator(runtimes);
    this.rebuildPickHelpers();
    this.scene.add(group);
    this.setGroundVisible(true);
    this.applyFilters();
    this.applySkinRaycast();
    this.resetCamera();
    this.resize();
  }

  resetCamera(): void {
    this.camAnimating = false;
    this.camera.position.set(1.15, 1.15, 2.35);
    this.controls.target.set(0, 0.95, 0);
    this.controls.update();
    if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.density = this.baseFogDensity;
  }

  setGroundVisible(visible: boolean): void {
    this.ground.visible = visible;
    const mat = this.ground.material as THREE.MeshStandardMaterial;
    if (visible) {
      // restore theme opacity on show — setTheme may have set it
      mat.opacity = mat.opacity < 0.05 ? 0.55 : mat.opacity;
      mat.transparent = true;
      mat.needsUpdate = true;
    }
  }

  private animate = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.animate);
    if (this.pageHidden) return;

    const animating = this.animator?.isAnimating ?? false;

    if (this.animator) this.animator.update();
    this.updateCameraTween();
    this.controls.update();
    if (this.bodyGroup && this.animator && !animating && this.animator.currentMode === 'rest') {
      const et = this.clock.getElapsedTime();
      this.bodyGroup.rotation.y = Math.sin(et * 0.15) * 0.03;
    } else if (this.bodyGroup && this.animator?.currentMode === 'grid') {
      this.bodyGroup.rotation.y *= 0.92;
    }
    this.renderer.render(this.scene, this.camera);
  };

  private updateCameraTween(): void {
    if (!this.camAnimating) return;
    const elapsed = (performance.now() - this.camStartTime) / 1000;
    const t = Math.min(1, elapsed / this.camDuration);
    const e = 1 - Math.pow(1 - t, 3);
    this.camera.position.lerpVectors(this.camStartPos, this.camEndPos, e);
    this.controls.target.lerpVectors(this.camStartTarget, this.camEndTarget, e);
    if (t >= 1) this.camAnimating = false;
  }

  private easeCameraTo(
    target: THREE.Vector3,
    distance: number,
    duration = 1.8,
    opts?: { resetViewDir?: boolean; screenBiasY?: number },
  ): void {
    this.camStartPos.copy(this.camera.position);
    this.camStartTarget.copy(this.controls.target);

    // Optional NDC Y bias: positive places the look-at point higher on screen
    // (used so examine framing sits above the bottom sheet).
    this._lookTarget.copy(target);
    const bias = opts?.screenBiasY ?? 0;
    if (Math.abs(bias) > 1e-4) {
      const vFov = THREE.MathUtils.degToRad(this.camera.fov);
      const worldOffset = Math.tan(vFov * 0.5) * distance * bias;
      this._lookTarget.y -= worldOffset;
    }
    this.camEndTarget.copy(this._lookTarget);

    if (opts?.resetViewDir) {
      // Canonical 3/4 view — clears examine close-ups stuck on tiny organs
      this._camDir.set(0.55, 0.38, 1);
    } else {
      this._camDir.copy(this.camera.position).sub(this.controls.target);
      if (this._camDir.lengthSq() < 1e-6) this._camDir.set(0.6, 0.45, 1);
    }
    this._camDir.normalize().multiplyScalar(distance);
    this.camEndPos.copy(this._lookTarget).add(this._camDir);
    this.camDuration = duration;
    this.camStartTime = performance.now();
    this.camAnimating = true;
  }

  private onResize = (): void => {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  };

  private getVisibleRuntimes(): PartRuntime[] {
    const q = this.searchQuery;
    const out: PartRuntime[] = [];
    for (const r of this.runtimes) {
      if (!r.mesh.visible) continue;
      if (
        q &&
        !r.part.nome.toLowerCase().includes(q) &&
        !(r.part.latino?.toLowerCase().includes(q)) &&
        !(r.part.en?.toLowerCase().includes(q))
      ) {
        continue;
      }
      out.push(r);
    }
    return out;
  }

  /** Skin is pickable only in grid mode; in assembled mode clicks pass through to organs. */
  private isSkinPickable(): boolean {
    return this.animator?.currentMode === 'grid';
  }

  private applySkinRaycast(): void {
    const pickable = this.isSkinPickable();
    for (const r of this.runtimes) {
      if (r.part.sistema !== 'tegumentario') continue;
      if (pickable) {
        r.mesh.raycast = THREE.Mesh.prototype.raycast;
        if (r.pickHelper) r.pickHelper.raycast = THREE.Mesh.prototype.raycast;
      } else {
        r.mesh.raycast = BodyScene.NO_RAYCAST as typeof THREE.Mesh.prototype.raycast;
        if (r.pickHelper) {
          r.pickHelper.raycast = BodyScene.NO_RAYCAST as typeof THREE.Mesh.prototype.raycast;
        }
      }
    }
  }

  private clearPickHelpers(): void {
    for (const r of this.runtimes) {
      const h = r.pickHelper;
      if (!h) continue;
      this.meshToIndex.delete(h);
      h.removeFromParent();
      r.pickHelper = undefined;
    }
  }

  /**
   * Invisible slightly-larger spheres parented to each part mesh.
   * Used only for raycasting so tiny anatomy stays easy to tap without visual bloat.
   */
  private rebuildPickHelpers(): void {
    this.clearPickHelpers();
    const grid = this.animator?.currentMode === 'grid';
    // Keep helpers tight: only a slight inflate so tiny parts remain tappable, not distant grabs.
    const inflate = grid ? 1.22 : 1.08;
    const minRadius = grid ? 0.014 : 0.008;
    for (const r of this.runtimes) {
      const geo = r.mesh.geometry;
      if (!geo.boundingSphere) geo.computeBoundingSphere();
      const bs = geo.boundingSphere;
      if (!bs) continue;
      const helper = new THREE.Mesh(this.pickHelperGeo, this.pickHelperMat);
      helper.visible = false;
      helper.frustumCulled = false;
      helper.position.copy(bs.center);
      helper.scale.setScalar(Math.max(bs.radius * inflate, minRadius));
      helper.userData.isPickHelper = true;
      helper.userData.partIndex = r.mesh.userData.partIndex;
      r.mesh.add(helper);
      r.pickHelper = helper;
      const idx = this.meshToIndex.get(r.mesh);
      if (idx !== undefined) this.meshToIndex.set(helper, idx);
    }
    this.applySkinRaycast();
  }

  /** Retune helper radii when switching rest ↔ grid (meshes keep visual size). */
  private syncPickHelperSizes(): void {
    const grid = this.animator?.currentMode === 'grid';
    const inflate = grid ? 1.22 : 1.08;
    const minRadius = grid ? 0.014 : 0.008;
    for (const r of this.runtimes) {
      const h = r.pickHelper;
      if (!h) continue;
      const geo = r.mesh.geometry;
      if (!geo.boundingSphere) geo.computeBoundingSphere();
      const bs = geo.boundingSphere;
      if (!bs) continue;
      h.scale.setScalar(Math.max(bs.radius * inflate, minRadius));
    }
  }

  private isCoarsePointer(event: PointerEvent): boolean {
    if (event.pointerType === 'touch') return true;
    try {
      if (window.matchMedia('(pointer: coarse)').matches) return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  /** Modest screen-space fallback only when almost on a part (never huge nearest-organ grabs). */
  private getPickRadiusPx(event: PointerEvent): number {
    const coarse = this.isCoarsePointer(event);
    const narrow = this.canvas.clientWidth > 0 && this.canvas.clientWidth < 720;
    const grid = this.animator?.currentMode === 'grid';
    let px = 6; // desktop: tiny fallback
    if (coarse || narrow) px = 12;
    if (grid) px += coarse || narrow ? 6 : 4;
    return px;
  }

  private _pickProj = new THREE.Vector3();
  private _pickBox = new THREE.Box3();

  /**
   * True if the pointer lies over the screen projection of visible anatomy
   * (body / grid AABB). Outside the silhouette → no selection / no nearest grab.
   */
  private isPointerOverAnatomyProjection(
    localX: number,
    localY: number,
    rect: DOMRect,
    visible: PartRuntime[],
    marginPx = 10,
  ): boolean {
    if (!visible.length) return false;
    this._pickBox.makeEmpty();
    for (const r of visible) {
      if (r.part.sistema === 'tegumentario' && !this.isSkinPickable()) continue;
      r.mesh.updateWorldMatrix(true, false);
      const geo = r.mesh.geometry;
      if (!geo.boundingBox) geo.computeBoundingBox();
      if (!geo.boundingBox) continue;
      this._tmpWorldBox.copy(geo.boundingBox).applyMatrix4(r.mesh.matrixWorld);
      this._pickBox.union(this._tmpWorldBox);
    }
    if (this._pickBox.isEmpty()) return false;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const min = this._pickBox.min;
    const max = this._pickBox.max;
    for (let i = 0; i < 8; i++) {
      this._pickProj.set(
        i & 1 ? max.x : min.x,
        i & 2 ? max.y : min.y,
        i & 4 ? max.z : min.z,
      );
      this._pickProj.project(this.camera);
      if (!Number.isFinite(this._pickProj.x) || !Number.isFinite(this._pickProj.y)) continue;
      const sx = (this._pickProj.x * 0.5 + 0.5) * rect.width;
      const sy = (-this._pickProj.y * 0.5 + 0.5) * rect.height;
      minX = Math.min(minX, sx);
      maxX = Math.max(maxX, sx);
      minY = Math.min(minY, sy);
      maxY = Math.max(maxY, sy);
    }
    if (!Number.isFinite(minX)) return false;
    return (
      localX >= minX - marginPx &&
      localX <= maxX + marginPx &&
      localY >= minY - marginPx &&
      localY <= maxY + marginPx
    );
  }

  /**
   * Prefer real mesh hits. Screen-space padding is a small fallback only when
   * the pointer is already over the body/grid silhouette — empty background
   * never selects a distant nearest organ.
   */
  private pick(event: PointerEvent): PartRuntime | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;

    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const radiusPx = this.getPickRadiusPx(event);
    const allowSkin = this.isSkinPickable();

    const visible = this.getVisibleRuntimes();
    const meshes = this._pickMeshes;
    const helpers = this._pickHelpers;
    meshes.length = 0;
    helpers.length = 0;
    for (const r of visible) {
      meshes.push(r.mesh);
      if (r.pickHelper) helpers.push(r.pickHelper);
    }

    type Cand = {
      runtime: PartRuntime;
      screenDist: number;
      rayDist: number;
      fromMesh: boolean;
    };
    const bestRef: { current: Cand | null } = { current: null };

    const resolveRuntime = (obj: THREE.Object3D): PartRuntime | null => {
      const idx =
        this.meshToIndex.get(obj as THREE.Mesh) ??
        (typeof obj.userData.partIndex === 'number' ? obj.userData.partIndex : undefined);
      if (idx === undefined) return null;
      const runtime = this.runtimes[idx];
      if (!runtime) return null;
      if (runtime.part.sistema === 'tegumentario' && !allowSkin) return null;
      return runtime;
    };

    const consider = (
      hit: THREE.Intersection,
      screenDist: number,
      fromMesh: boolean,
    ): void => {
      const runtime = resolveRuntime(hit.object);
      if (!runtime) return;
      const best = bestRef.current;
      if (
        !best ||
        screenDist < best.screenDist - 0.35 ||
        (Math.abs(screenDist - best.screenDist) <= 0.35 &&
          ((fromMesh && !best.fromMesh) ||
            (fromMesh === best.fromMesh && hit.distance < best.rayDist)))
      ) {
        bestRef.current = { runtime, screenDist, rayDist: hit.distance, fromMesh };
      }
    };

    const castAt = (
      lx: number,
      ly: number,
      screenDist: number,
      targets: THREE.Object3D[],
      fromMesh: boolean,
    ): void => {
      if (!targets.length) return;
      this.pointer.x = (lx / rect.width) * 2 - 1;
      this.pointer.y = -(ly / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObjects(targets, false);
      for (const hit of hits) {
        const runtime = resolveRuntime(hit.object);
        if (!runtime) continue;
        consider(hit, screenDist, fromMesh);
        break;
      }
    };

    // 1) Precise center hit on real meshes first
    castAt(localX, localY, 0, meshes, true);

    // Fallback only when already over body/grid silhouette (empty bg never nearest-grabs)
    if (!bestRef.current) {
      const overSilhouette = this.isPointerOverAnatomyProjection(
        localX,
        localY,
        rect,
        visible,
        8,
      );
      if (overSilhouette) {
        // 2) Center helper for tiny parts whose triangles miss the tap
        castAt(localX, localY, 0, helpers, false);

        // 3) Small screen-space ring: prefer real meshes, then helpers
        if (!bestRef.current && radiusPx > 0) {
          const count = 8;
          for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2;
            const sx = localX + Math.cos(a) * radiusPx;
            const sy = localY + Math.sin(a) * radiusPx;
            castAt(sx, sy, radiusPx, meshes, true);
          }
          if (!bestRef.current && helpers.length) {
            for (let i = 0; i < count; i++) {
              const a = (i / count) * Math.PI * 2;
              const sx = localX + Math.cos(a) * radiusPx;
              const sy = localY + Math.sin(a) * radiusPx;
              castAt(sx, sy, radiusPx, helpers, false);
            }
          }
        }
      }
    }

    return bestRef.current?.runtime ?? null;
  }

  private getTapMoveThreshold(event: PointerEvent): number {
    return this.isCoarsePointer(event) ? TAP_MOVE_THRESHOLD_TOUCH : TAP_MOVE_THRESHOLD_MOUSE;
  }

  /** True for primary-button / single-finger rotate (not pan/dolly modifiers or multi-touch). */
  private isRotateGestureStart(event: PointerEvent): boolean {
    if (event.button !== 0) return false;
    if (event.ctrlKey || event.metaKey || event.shiftKey) return false;
    if (this.activePointers.size > 1) return false;
    return true;
  }

  private clearGesture(): void {
    this.gesturePointerId = null;
    this.gestureSelectArmed = false;
    this.gestureIsDrag = false;
    this.pendingSelect = null;
  }

  private commitSelection(hit: PartRuntime | null, clientX: number, clientY: number): void {
    if (this.examining) {
      if (hit && hit !== this.examineRuntime) {
        this.enterExamine(hit, this.examineMode);
      }
      return;
    }
    if (this.selected && this.selected !== hit) {
      setPartHighlight(this.selected, false);
    }
    this.selected = hit;
    if (hit) {
      setPartHighlight(hit, true);
      this.onDetail(hit.part, clientX, clientY, { selected: true });
    } else {
      this.onDetail(null, clientX, clientY);
    }
  }

  private onPointerMove = (event: PointerEvent): void => {
    // Promote pending press → orbit drag once past threshold (mouse + touch).
    // Drag must not change selection; orbit keeps subject/model center as fulcrum.
    if (
      this.gesturePointerId !== null &&
      event.pointerId === this.gesturePointerId &&
      !this.gestureIsDrag
    ) {
      const dx = event.clientX - this.gestureStartX;
      const dy = event.clientY - this.gestureStartY;
      const thresh = this.getTapMoveThreshold(event);
      if (dx * dx + dy * dy >= thresh * thresh) {
        this.gestureIsDrag = true;
        this.gestureSelectArmed = false;
        // Drop soft preview highlight of the press candidate — selection stays as-is.
        const pending = this.pendingSelect;
        if (
          pending &&
          pending !== this.selected &&
          this.hovered === pending
        ) {
          setPartHighlight(pending, false);
          this.hovered = null;
        }
        this.pendingSelect = null;
      }
    }

    // Hover preview only for mouse, and not while dragging / examining.
    if (event.pointerType === 'touch') return;
    if (this.examining) return;
    if (this.gestureIsDrag) return;
    if (this.gestureSelectArmed) {
      // Soft preview of pending tap candidate without committing selection.
      const hit = this.pendingSelect;
      if (hit && hit !== this.hovered && hit !== this.selected) {
        if (this.hovered && this.hovered !== this.selected) {
          setPartHighlight(this.hovered, false);
        }
        this.hovered = hit;
        setPartHighlight(hit, true);
      }
      return;
    }

    const hit = this.pick(event);
    if (hit === this.hovered) return;
    if (this.hovered && this.hovered !== this.selected) {
      setPartHighlight(this.hovered, false);
    }
    this.hovered = hit;
    if (hit) {
      setPartHighlight(hit, true);
      this.onDetail(hit.part, event.clientX, event.clientY, {
        selected: hit === this.selected,
      });
    } else if (!this.selected) {
      this.onDetail(null, event.clientX, event.clientY);
    } else {
      this.onDetail(this.selected.part, event.clientX, event.clientY, { selected: true });
    }
  };

  private onPointerDown = (event: PointerEvent): void => {
    this.activePointers.add(event.pointerId);

    // Only primary single-finger/button arms tap-select.
    // Orbit fulcrum stays on framing center (body/grid/examine) — no drag-start retarget.
    if (!this.isRotateGestureStart(event)) {
      // Multi-touch / pan / dolly: cancel any pending select; leave orbit target alone
      // (do NOT snap target on 2-finger pan end).
      if (this.activePointers.size > 1) {
        this.gestureSelectArmed = false;
        this.pendingSelect = null;
      }
      return;
    }

    const hit = this.pick(event);
    this.gesturePointerId = event.pointerId;
    this.gestureStartX = event.clientX;
    this.gestureStartY = event.clientY;
    this.gestureIsDrag = false;
    this.gestureSelectArmed = true;
    this.pendingSelect = hit;

    // Soft highlight of tap candidate only (do NOT commit selection yet).
    if (!this.examining && hit && hit !== this.selected && hit !== this.hovered) {
      if (this.hovered && this.hovered !== this.selected) {
        setPartHighlight(this.hovered, false);
      }
      this.hovered = hit;
      setPartHighlight(hit, true);
    }
  };

  private onPointerUp = (event: PointerEvent): void => {
    this.activePointers.delete(event.pointerId);

    if (this.gesturePointerId !== null && event.pointerId !== this.gesturePointerId) {
      return;
    }

    const wasArmed = this.gestureSelectArmed && !this.gestureIsDrag;
    const pending = this.pendingSelect;
    const x = event.clientX;
    const y = event.clientY;
    this.clearGesture();

    // Tap: commit selection / examine switch. Drag: keep current selection.
    if (wasArmed) {
      this.commitSelection(pending, x, y);
    }
  };

  setSystemVisibility(id: SystemId, visible: boolean): void {
    if (visible) this.visibleSystems.add(id);
    else this.visibleSystems.delete(id);
    this.applyFilters();
  }

  setAllSystems(visible: boolean, ids: SystemId[]): void {
    this.visibleSystems.clear();
    if (visible) ids.forEach((id) => this.visibleSystems.add(id));
    this.applyFilters();
  }

  setSearch(query: string): void {
    this.searchQuery = query.trim().toLowerCase();
    this.applyFilters();
  }

  private applyFilters(): void {
    const q = this.searchQuery;
    for (const r of this.runtimes) {
      const sysOk = this.visibleSystems.has(r.part.sistema);
      const searchOk =
        !q ||
        r.part.nome.toLowerCase().includes(q) ||
        (r.part.latino?.toLowerCase().includes(q) ?? false) ||
        (r.part.en?.toLowerCase().includes(q) ?? false);
      r.mesh.visible = sysOk && searchOk;
    }
    // In grid mode, newly shown parts must take grid slots (never assembled center).
    // Already-visible parts reshuffle if the layout reflows.
    if (this.animator?.currentMode === 'grid') {
      this.reflowGrid({ duration: 1.05, animateCamera: false });
    }
    if (this.examining && this.examineRuntime) {
      if (!this.isFilterEligible(this.examineRuntime)) {
        this.exitExamine(true);
        return;
      }
      // Rebuild examine overlays from current filter eligibility
      this.applyExamineVisuals();
      this.emitExamineChange();
    }
  }

  /**
   * Compute an invisible neat grid for currently visible parts.
   * Sorted by anatomical system then Italian name (educational order).
   */
  private layoutGrid(visible: PartRuntime[]): { center: THREE.Vector3; extent: number; order: PartRuntime[] } {
    const sortedAll = [...visible].sort((a, b) => {
      const oa = SYSTEM_ORDER[a.part.sistema] ?? 99;
      const ob = SYSTEM_ORDER[b.part.sistema] ?? 99;
      if (oa !== ob) return oa - ob;
      return a.part.nome.localeCompare(b.part.nome, 'it');
    });

    // Cute/skin (if any): dedicate a row BELOW the rest so it never overlaps.
    // No-op gracefully when tegumentario is empty (e.g. Femmina without full-body cute).
    const skin = sortedAll.filter((r) => r.part.sistema === 'tegumentario');
    const sorted = sortedAll.filter((r) => r.part.sistema !== 'tegumentario');

    const radiusOf = (r: PartRuntime): number => {
      const geo = r.mesh.geometry;
      const bs = geo.boundingSphere ?? (geo.computeBoundingSphere(), geo.boundingSphere);
      return bs ? bs.radius : 0.025;
    };

    const measure = sorted.length ? sorted : sortedAll;
    const radii = measure.map(radiusOf).sort((a, b) => a - b);
    const median = radii[Math.floor(radii.length / 2)] || 0.025;
    // Cap outliers so one giant mesh does not stretch the whole grid
    const clipped = radii.map((r) => Math.min(r, median * 2.2));
    let avgRadius = 0;
    for (const r of clipped) avgRadius += r;
    avgRadius = Math.max(0.018, avgRadius / Math.max(1, clipped.length));
    const spacing = THREE.MathUtils.clamp(avgRadius * 2.55, 0.045, 0.2);
    const cellRadius = spacing * 0.4;

    const n = Math.max(1, sorted.length);
    const aspect = 1.35;
    const cols = Math.max(1, Math.ceil(Math.sqrt(n * aspect)));
    const rows = Math.max(1, Math.ceil(n / cols));

    const gridW = (cols - 1) * spacing;
    const gridH = (rows - 1) * spacing;
    const centerY = 0.95;
    const originX = -gridW / 2;
    const originY = centerY + gridH / 2;

    sorted.forEach((r, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      r.alignTarget.set(originX + col * spacing, originY - row * spacing, 0);
      const rad = radiusOf(r);
      // Normalize display size in grid so outliers do not dominate a row
      r.alignScale = rad > 1e-6 ? Math.min(1, cellRadius / rad) : 1;
    });

    // Skin alone on its own row BELOW — keep natural/readable world scale (never thumbnail)
    let skinExtra = 0;
    if (skin.length) {
      let skinR = 0;
      for (const r of skin) {
        r.alignScale = 1; // assembled size
        skinR = Math.max(skinR, radiusOf(r));
      }
      const gap = Math.max(spacing * 3.5, skinR * 2.15 + spacing * 1.6);
      const skinY = originY - (rows - 1) * spacing - gap;
      const skinSpan = Math.max(
        gridW,
        skin.length > 1 ? (skin.length - 1) * Math.max(spacing * 2.0, skinR * 2.1) : 0,
      );
      skin.forEach((r, i) => {
        const x =
          skin.length === 1
            ? 0
            : -skinSpan / 2 + (i / Math.max(1, skin.length - 1)) * skinSpan;
        r.alignTarget.set(x, skinY, 0);
      });
      skinExtra = gap + skinR;
    }

    const order = sorted.concat(skin);
    const extent = Math.max(gridW, gridH + skinExtra, 0.6);
    const center = new THREE.Vector3(0, centerY - skinExtra * 0.28, 0);
    return { center, extent, order };
  }

  getLayoutMode(): 'rest' | 'grid' {
    return this.animator?.currentMode ?? 'rest';
  }

  /**
   * Place currently visible parts into a recomputed invisible grid.
   * Used by Allinea and by filter/search changes while already in grid mode.
   */
  private reflowGrid(opts?: { duration?: number; animateCamera?: boolean }): void {
    if (!this.animator) return;
    if (this.bodyGroup) this.bodyGroup.rotation.y = 0;
    const visible = this.getVisibleRuntimes();
    if (!visible.length) return;
    this.setGroundVisible(false);
    const { center, extent, order } = this.layoutGrid(visible);
    const indices = order
      .map((r) => this.meshToIndex.get(r.mesh))
      .filter((i): i is number => i !== undefined);
    this.animator.allinea(indices, {
      duration: opts?.duration,
      lift: opts?.animateCamera === false ? 0.045 : 0.09,
    });
    this.applySkinRaycast();
    this.syncPickHelperSizes();

    if (opts?.animateCamera === false) return;

    // World-space center (group may be offset)
    const worldCenter = center.clone();
    if (this.bodyGroup) this.bodyGroup.localToWorld(worldCenter);
    const dist = Math.min(12, Math.max(2.2, extent * 1.55 + 1.1));
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = extent > 3 ? this.baseFogDensity * 0.45 : this.baseFogDensity;
    }
    this.easeCameraTo(worldCenter, dist, 2.0, { resetViewDir: true });
  }

  /** Primary action: align visible parts into an invisible grid. */
  allinea(): void {
    // Soft-exit Esamina so materials/camera overrides clear before layout framing
    if (this.examining) this.exitExamine(false);
    this.reflowGrid({ animateCamera: true });
  }

  /** Alias kept for clarity: Esplodi now means grid align. */
  explode(): void {
    this.allinea();
  }

  recomponi(): void {
    if (!this.animator) return;
    // Soft-exit Esamina so OrbitControls target is not left on a tiny organ
    if (this.examining) this.exitExamine(false);
    this.setGroundVisible(true);
    // Return every part that isn't already at rest (visible + any previously grid-moved)
    const indices: number[] = [];
    for (let i = 0; i < this.runtimes.length; i++) {
      const r = this.runtimes[i];
      const scaled = Math.abs(r.mesh.scale.x - 1) > 1e-4;
      if (!r.mesh.position.equals(r.restPosition) || scaled) indices.push(i);
      else if (r.mesh.visible) indices.push(i);
    }
    // Prefer animating all visible + displaced; if empty, animate all
    const unique = indices.length ? [...new Set(indices)] : this.runtimes.map((_, i) => i);
    this.animator.recomponi(unique);
    this.applySkinRaycast();
    this.syncPickHelperSizes();
    if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.density = this.baseFogDensity;
    const canine = this.bodyGroup?.userData?.species === 'cane';
    this.easeCameraTo(
      new THREE.Vector3(0, canine ? 0.55 : 0.95, 0),
      canine ? 3.8 : 2.7,
      1.9,
      { resetViewDir: true },
    );
  }

  setExamineChangeCallback(cb: ExamineChangeCallback | null): void {
    this.onExamineChange = cb;
  }

  isExamining(): boolean {
    return this.examining;
  }

  getExamineMode(): ExamineMode {
    return this.examineMode;
  }

  getSelectedPart(): AnatomyPart | null {
    return this.selected?.part ?? null;
  }

  /** Clear part selection and close the basic detail card (deselect). */
  clearSelection(): void {
    const wasExamining = this.examining;
    if (this.selected) {
      setPartHighlight(this.selected, false);
      this.selected = null;
    }
    if (this.hovered) {
      setPartHighlight(this.hovered, false);
      this.hovered = null;
    }
    if (wasExamining) {
      this.exitExamine(false);
    }
    this.onDetail(null, 0, 0);
  }

  enterExamineFromSelection(mode: ExamineMode = 'nel-corpo'): boolean {
    if (!this.selected) return false;
    this.enterExamine(this.selected, mode);
    return true;
  }

  enterExamineByPartId(partId: string, mode?: ExamineMode): boolean {
    const rt = this.runtimes.find((r) => r.part.id === partId);
    if (!rt || !rt.mesh.visible) return false;
    this.enterExamine(rt, mode ?? this.examineMode);
    return true;
  }

  setExamineMode(mode: ExamineMode): void {
    if (!this.examining || !this.examineRuntime) {
      this.examineMode = mode;
      return;
    }
    if (this.examineMode === mode) return;
    this.examineMode = mode;
    this.applyExamineVisuals();
    this.emitExamineChange();
    const rt = this.examineRuntime;
    const dur = mode === 'solo' ? 1.15 : 1.35;
    requestAnimationFrame(() => {
      if (this.disposed || !this.examining || this.examineRuntime !== rt) return;
      this.focusCameraOnRuntime(rt, dur);
    });
  }

  enterExamine(runtime: PartRuntime, mode: ExamineMode = 'nel-corpo'): void {
    if (this.examining) {
      this.restoreExamineMaterials();
    }
    this.examining = true;
    this.examineMode = mode;
    this.examineRuntime = runtime;
    this.selected = runtime;
    this.hovered = null;
    this.onDetail(null, 0, 0);
    this.captureExamineSnapshots();
    this.applyExamineVisuals();
    this.emitExamineChange();
    // Frame after UI paints so bottom sheet height is measurable (mobile safe space)
    const dur = mode === 'solo' ? 1.2 : 1.45;
    requestAnimationFrame(() => {
      if (this.disposed || !this.examining || this.examineRuntime !== runtime) return;
      this.focusCameraOnRuntime(runtime, dur);
    });
  }

  exitExamine(animateCamera = true): void {
    if (!this.examining && this.examineSnapshots.length === 0) {
      this.emitExamineChange();
      return;
    }
    this.restoreExamineMaterials();
    this.examining = false;
    this.examineRuntime = null;
    this.examineMode = 'nel-corpo';
    // Re-apply filter visibility cleanly (no ghost transparency)
    const q = this.searchQuery;
    for (const r of this.runtimes) {
      const sysOk = this.visibleSystems.has(r.part.sistema);
      const searchOk =
        !q ||
        r.part.nome.toLowerCase().includes(q) ||
        (r.part.latino?.toLowerCase().includes(q) ?? false) ||
        (r.part.en?.toLowerCase().includes(q) ?? false);
      r.mesh.visible = sysOk && searchOk;
      if (this.selected && r === this.selected) {
        setPartHighlight(r, true);
      } else {
        setPartHighlight(r, false);
      }
    }
    if (animateCamera) {
      if (this.animator?.currentMode === 'grid') {
        const visible = this.getVisibleRuntimes();
        if (visible.length) {
          const { center, extent } = this.layoutGrid(visible);
          const worldCenter = center.clone();
          if (this.bodyGroup) this.bodyGroup.localToWorld(worldCenter);
          const dist = Math.min(12, Math.max(2.4, extent * 1.55 + 1.1));
          this.easeCameraTo(worldCenter, dist, 1.25, { resetViewDir: true });
        } else {
          this.easeCameraTo(new THREE.Vector3(0, 0.95, 0), 3.2, 1.25, { resetViewDir: true });
        }
      } else {
        const canine = this.bodyGroup?.userData?.species === 'cane';
        this.easeCameraTo(
          new THREE.Vector3(0, canine ? 0.55 : 0.95, 0),
          canine ? 3.8 : 2.7,
          1.35,
          { resetViewDir: true },
        );
      }
    }
    if (this.selected) {
      this.onDetail(this.selected.part, window.innerWidth * 0.5, window.innerHeight * 0.35, {
        selected: true,
      });
    }
    this.emitExamineChange();
  }

  getRelatedParts(part: AnatomyPart, limit = 14): AnatomyPart[] {
    const out: AnatomyPart[] = [];
    for (const r of this.runtimes) {
      if (r.part.id === part.id) continue;
      if (r.part.sistema !== part.sistema) continue;
      if (!this.isFilterEligible(r)) continue;
      out.push(r.part);
      if (out.length >= limit) break;
    }
    return out.sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
  }

  private isFilterEligible(r: PartRuntime): boolean {
    const sysOk = this.visibleSystems.has(r.part.sistema);
    const q = this.searchQuery;
    const searchOk =
      !q ||
      r.part.nome.toLowerCase().includes(q) ||
      (r.part.latino?.toLowerCase().includes(q) ?? false) ||
      (r.part.en?.toLowerCase().includes(q) ?? false);
    return sysOk && searchOk;
  }

  private emitExamineChange(): void {
    const part = this.examineRuntime?.part ?? null;
    this.onExamineChange?.({
      active: this.examining,
      mode: this.examineMode,
      part,
      related: part ? this.getRelatedParts(part) : [],
    });
  }

  private disposeExamineClones(): void {
    for (const m of this.examineClones) m.dispose();
    this.examineClones = [];
  }

  private captureExamineSnapshots(): void {
    this.restoreExamineMaterials();
    this.examineSnapshots = [];
    for (const r of this.runtimes) {
      this.examineSnapshots.push({
        mesh: r.mesh,
        material: r.mesh.material,
        visible: r.mesh.visible,
      });
    }
  }

  private restoreExamineMaterials(): void {
    for (const snap of this.examineSnapshots) {
      snap.mesh.material = snap.material;
      snap.mesh.visible = snap.visible;
    }
    this.examineSnapshots = [];
    this.disposeExamineClones();
  }

  private cloneMeshMaterial(
    mesh: THREE.Mesh,
    mutate: (mat: THREE.MeshStandardMaterial) => void,
  ): void {
    const src = mesh.material;
    if (Array.isArray(src)) {
      const clones = src.map((m) => {
        const c = (m as THREE.MeshStandardMaterial).clone();
        mutate(c);
        this.examineClones.push(c);
        return c;
      });
      mesh.material = clones;
      return;
    }
    const clone = (src as THREE.MeshStandardMaterial).clone();
    mutate(clone);
    this.examineClones.push(clone);
    mesh.material = clone;
  }

  private applyExamineVisuals(): void {
    if (!this.examineRuntime) return;
    const target = this.examineRuntime;
    const solo = this.examineMode === 'solo';
    const dimOpacity = 0.1;

    // Drop previous examine clones, then rebuild from original shared materials
    for (const snap of this.examineSnapshots) {
      snap.mesh.material = snap.material;
    }
    this.disposeExamineClones();

    const snapByMesh = new Map(this.examineSnapshots.map((s) => [s.mesh, s]));

    for (const r of this.runtimes) {
      const snap = snapByMesh.get(r.mesh);
      const baseVisible = this.isFilterEligible(r);
      if (snap) {
        r.mesh.material = snap.material;
      }

      if (r === target) {
        r.mesh.visible = true;
        this.cloneMeshMaterial(r.mesh, (mat) => {
          mat.transparent = mat.opacity < 0.99 || r.part.sistema === 'tegumentario';
          mat.opacity = r.part.sistema === 'tegumentario' ? Math.max(0.55, mat.opacity) : 1;
          mat.depthWrite = r.part.sistema !== 'tegumentario';
          mat.emissive.copy(mat.color);
          mat.emissiveIntensity = 0.32;
          mat.needsUpdate = true;
        });
        continue;
      }

      if (solo) {
        r.mesh.visible = false;
        continue;
      }

      // Nel corpo: keep anatomical context, dim others
      if (!baseVisible) {
        r.mesh.visible = false;
        continue;
      }
      r.mesh.visible = true;
      this.cloneMeshMaterial(r.mesh, (mat) => {
        mat.transparent = true;
        mat.opacity = r.part.sistema === 'tegumentario' ? Math.min(0.06, dimOpacity) : dimOpacity;
        mat.depthWrite = false;
        mat.emissiveIntensity = 0;
        mat.needsUpdate = true;
      });
    }
  }

  /** Public reframe after examine sheet expand/collapse on mobile. */
  reframeExamineCamera(duration = 0.85): void {
    if (!this.examining || !this.examineRuntime) return;
    this.focusCameraOnRuntime(this.examineRuntime, duration);
  }

  /**
   * Bottom UI inset as a fraction of canvas height (examine sheet + safe area).
   * Used so OrbitControls framing leaves the organ in the visible band above the panel.
   */
  private getExamineBottomInsetFrac(): number {
    const h = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    const w = this.canvas.clientWidth || window.innerWidth;
    const panel = document.getElementById('examine-panel');
    if (panel && !panel.hidden) {
      const canvasRect = this.canvas.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const overlap = Math.max(0, canvasRect.bottom - panelRect.top);
      // small extra breathing room above the sheet
      return THREE.MathUtils.clamp((overlap + 12) / h, 0, 0.62);
    }
    // Estimate before first paint / layout
    if (w <= 860) {
      const compact = document.body.classList.contains('examine-compact');
      const px = compact ? Math.min(h * 0.26, 190) : Math.min(h * 0.4, 300);
      return THREE.MathUtils.clamp((px + 12) / h, 0.18, 0.55);
    }
    return THREE.MathUtils.clamp(220 / h, 0.12, 0.4);
  }

  private focusCameraOnRuntime(
    runtime: PartRuntime,
    duration = 1.4,
    padScale?: number,
  ): void {
    const mesh = runtime.mesh;
    mesh.updateWorldMatrix(true, true);
    const geo = mesh.geometry;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    const sphere = geo.boundingSphere!.clone();
    sphere.applyMatrix4(mesh.matrixWorld);
    const radius = Math.max(0.02, sphere.radius);
    const narrow = (this.canvas.clientWidth || window.innerWidth) <= 860;
    const modePad = padScale ?? (this.examineMode === 'solo' ? 3.6 : 4.4);
    // Extra distance on mobile so the part fits in the shrunk visible band
    const pad = narrow ? modePad * 1.12 : modePad;
    let dist = Math.min(
      this.controls.maxDistance * 0.9,
      Math.max(this.controls.minDistance + 0.05, radius * pad + 0.28),
    );

    const bottomFrac = this.getExamineBottomInsetFrac();
    // Visible band is the top (1 - bottomFrac) of the screen; center of that band
    // in NDC is at y = bottomFrac (since full NDC span is 2, midpoint shift = bottomFrac).
    // screenBiasY > 0 lifts the framed organ into that visible band.
    const screenBiasY = bottomFrac > 0.08 ? bottomFrac : 0;

    // Enlarge framing distance so the sphere still fits inside the reduced vertical FOV
    if (bottomFrac > 0.08) {
      const usable = Math.max(0.38, 1 - bottomFrac);
      dist = Math.min(this.controls.maxDistance * 0.92, dist / usable);
    }

    this.easeCameraTo(sphere.center.clone(), dist, duration, { screenBiasY });
  }

  setTheme(theme: UiTheme): void {
    const t = THEME_SCENE[theme];
    this.scene.background = new THREE.Color(t.bg);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.set(t.bg);
      // Preserve relative fog reduction when zoomed out on a large grid
      const current = this.scene.fog.density;
      const wasReduced = current < this.baseFogDensity * 0.7;
      this.baseFogDensity = t.fogDensity;
      this.scene.fog.density = wasReduced ? t.fogDensity * 0.45 : t.fogDensity;
    } else {
      this.baseFogDensity = t.fogDensity;
      this.scene.fog = new THREE.FogExp2(t.bg, t.fogDensity);
    }

    this.ambientLight.color.set(t.ambient.color);
    this.ambientLight.intensity = t.ambient.intensity;
    this.keyLight.color.set(t.key.color);
    this.keyLight.intensity = t.key.intensity;
    this.rimLight.color.set(t.rim.color);
    this.rimLight.intensity = t.rim.intensity;
    this.fillLight.color.set(t.fill.color);
    this.fillLight.intensity = t.fill.intensity;
    this.hemiLight.color.set(t.hemiSky);
    this.hemiLight.groundColor.set(t.hemiGround);
    this.hemiLight.intensity = t.hemiIntensity;

    const mat = this.ground.material as THREE.MeshStandardMaterial;
    mat.color.set(t.ground);
    mat.opacity = t.groundOpacity;
    mat.needsUpdate = true;

    this.renderer.toneMappingExposure = t.exposure;
  }

  resize(): void {
    this.onResize();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.clearGesture();
    this.activePointers.clear();
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.removeEventListener('lostpointercapture', this.onPointerUp);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.clearPickHelpers();
    this.pickHelperGeo.dispose();
    this.pickHelperMat.dispose();
    this.controls.dispose();
    this.renderer.dispose();
  }
}

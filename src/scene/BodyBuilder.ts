import * as THREE from 'three';
import { SYSTEM_MAP } from '../data/systems';
import type {
  AnatomyCatalog,
  AnatomyPart,
  CatalogPartRecord,
  PartRuntime,
  SystemId,
} from '../types';

const MAT_CACHE = new Map<string, THREE.MeshStandardMaterial>();

function getMaterial(sistema: SystemId, highlight = false): THREE.MeshStandardMaterial {
  const key = `${sistema}-${highlight ? 'h' : 'n'}`;
  let mat = MAT_CACHE.get(key);
  if (!mat) {
    const info = SYSTEM_MAP[sistema];
    const isSkin = sistema === 'tegumentario';
    const isBone = sistema === 'scheletrico';
    const isVessel = sistema === 'circolatorio';
    const isNerve = sistema === 'nervoso';
    mat = new THREE.MeshStandardMaterial({
      color: info.colore,
      roughness: isBone ? 0.72 : isVessel ? 0.4 : isNerve ? 0.55 : 0.5,
      metalness: isBone ? 0.05 : isVessel ? 0.15 : 0.08,
      emissive: highlight ? info.colore : 0x000000,
      emissiveIntensity: highlight ? 0.28 : 0,
      transparent: isSkin,
      opacity: isSkin ? 0.18 : 0.98,
      depthWrite: !isSkin,
      side: isSkin ? THREE.DoubleSide : THREE.FrontSide,
    });
    MAT_CACHE.set(key, mat);
  }
  return mat;
}

function decodeGeometry(rec: CatalogPartRecord, bin: ArrayBuffer): THREE.BufferGeometry {
  const posView = new DataView(bin, rec.posOffset, rec.posBytes);
  const positions = new Float32Array(rec.vertexCount * 3);
  const [minX, minY, minZ] = rec.quantMin;
  const [sx, sy, sz] = rec.quantScale;
  for (let i = 0; i < rec.vertexCount; i++) {
    const o = i * 6;
    positions[i * 3] = minX + posView.getUint16(o, true) * sx;
    positions[i * 3 + 1] = minY + posView.getUint16(o + 2, true) * sy;
    positions[i * 3 + 2] = minZ + posView.getUint16(o + 4, true) * sz;
  }

  const idxView = new DataView(bin, rec.idxOffset, rec.idxBytes);
  const indices =
    rec.indexSize === 2 ? new Uint16Array(rec.indexCount) : new Uint32Array(rec.indexCount);
  for (let i = 0; i < rec.indexCount; i++) {
    indices[i] =
      rec.indexSize === 2
        ? idxView.getUint16(i * 2, true)
        : idxView.getUint32(i * 4, true);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

export type LoadProgress = (fraction: number, label: string) => void;

export function disposeBodyGroup(group: THREE.Group | null): void {
  if (!group) return;
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose();
    }
  });
  group.clear();
}

export async function createBodyGroup(
  catalog: AnatomyCatalog,
  onProgress?: LoadProgress,
): Promise<{
  group: THREE.Group;
  runtimes: PartRuntime[];
  meshToIndex: Map<THREE.Mesh, number>;
}> {
  const group = new THREE.Group();
  group.name = 'corpo';
  const runtimes: PartRuntime[] = [];
  const meshToIndex = new Map<THREE.Mesh, number>();

  const base = (catalog.baseUrl || `${import.meta.env.BASE_URL}models/bp3d`).replace(/\/$/, '');
  onProgress?.(0.02, `Download mesh (${catalog.source})…`);
  const binRes = await fetch(`${base}/${catalog.bin}`);
  if (!binRes.ok) throw new Error(`Impossibile scaricare ${catalog.bin}`);
  const bin = await binRes.arrayBuffer();
  onProgress?.(0.08, 'Decodifica geometrie anatomiche…');

  const records = catalog.parts;
  const total = records.length;
  const BATCH = 48;
  const centroid = new THREE.Vector3();
  let valid = 0;

  for (let start = 0; start < total; start += BATCH) {
    const end = Math.min(total, start + BATCH);
    for (let i = start; i < end; i++) {
      const rec = records[i];
      // Femmina: no full-body tegumentario (cute non inclusa); keep eyebrow/hair/lip only
      if (
        (catalog.sex === 'female' || catalog.species === 'donna') &&
        (rec.id === 'ADAPTIVE_SKIN' ||
          rec.id === 'BP3D_FJ2810' ||
          rec.id === 'FJ2810' ||
          rec.id === 'VH_F_skin' ||
          (rec.sistema === 'tegumentario' &&
            /^(skin|cute|involucro adattivo)$/i.test((rec.en || rec.nome || '').trim())))
      ) {
        continue;
      }
      if (
        (catalog.sex === 'female' || catalog.species === 'donna') &&
        /prostate|testis|penis|scrotum|epididymis|spermatic|seminal|deferens|foreskin|glans penis|cavernosum|spongiosum/i.test(
          `${rec.en || ''} ${rec.nome || ''} ${rec.id}`,
        )
      ) {
        continue;
      }
      const part: AnatomyPart = {
        id: rec.id,
        nome: rec.nome,
        sistema: rec.sistema,
        descrizione: rec.descrizione,
        latino: rec.latino || rec.en,
        en: rec.en,
        bp: rec.bp,
        fma: rec.fma,
      };

      let geo: THREE.BufferGeometry;
      try {
        geo = decodeGeometry(rec, bin);
      } catch {
        continue;
      }

      const center = new THREE.Vector3();
      if (geo.boundingBox) {
        geo.boundingBox.getCenter(center);
        geo.translate(-center.x, -center.y, -center.z);
        geo.computeBoundingBox();
        geo.computeBoundingSphere();
      }

      const mesh = new THREE.Mesh(geo, getMaterial(part.sistema));
      mesh.position.copy(center);
      mesh.frustumCulled = true;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.userData.partId = part.id;
      mesh.userData.sistema = part.sistema;
      if (part.sistema === 'tegumentario') mesh.renderOrder = 1;
      group.add(mesh);

      centroid.add(center);
      valid++;

      const idx = runtimes.length;
      mesh.userData.partIndex = idx;
      runtimes.push({
        part,
        mesh,
        restPosition: center.clone(),
        restQuaternion: mesh.quaternion.clone(),
        restScale: mesh.scale.clone(),
        alignTarget: center.clone(),
        alignScale: 1,
      });
      meshToIndex.set(mesh, idx);
    }
    onProgress?.(
      0.08 + 0.85 * (end / total),
      `Caricate ${end.toLocaleString('it-IT')} / ${total.toLocaleString('it-IT')} parti`,
    );
    await new Promise((r) => setTimeout(r, 0));
  }

  // Canine VT models: length along Z. Rotate 90° about Y so length is along X —
  // default camera (from +Z) sees a stable side profile in BOTH assembled and grid modes
  // (no bodyGroup yaw that would edge-on the grid).
  if (catalog.species === 'cane') {
    const yaw = Math.PI / 2;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    for (const r of runtimes) {
      const pos = r.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        const x = arr[i];
        const z = arr[i + 2];
        arr[i] = x * cos + z * sin;
        arr[i + 2] = -x * sin + z * cos;
      }
      pos.needsUpdate = true;
      r.mesh.geometry.computeBoundingBox();
      r.mesh.geometry.computeBoundingSphere();
      const p = r.restPosition;
      const nx = p.x * cos + p.z * sin;
      const nz = -p.x * sin + p.z * cos;
      p.set(nx, p.y, nz);
      r.mesh.position.copy(p);
      r.alignTarget.copy(p);
    }
  }

  if (valid > 0) centroid.multiplyScalar(1 / valid);
  // recompute centroid after canine yaw
  if (catalog.species === 'cane' && valid > 0) {
    centroid.set(0, 0, 0);
    for (const r of runtimes) centroid.add(r.restPosition);
    centroid.multiplyScalar(1 / valid);
  }

  group.userData.species = catalog.species || 'uomo';
  group.position.set(-centroid.x, 0, -centroid.z);
  group.updateMatrixWorld(true);
  const worldBox = new THREE.Box3().setFromObject(group);
  group.position.y -= worldBox.min.y;

  onProgress?.(1, 'Corpo anatomico pronto');
  return { group, runtimes, meshToIndex };
}

export function setPartHighlight(runtime: PartRuntime, on: boolean): void {
  runtime.mesh.material = getMaterial(runtime.part.sistema, on);
}

export function disposeBody(): void {
  MAT_CACHE.forEach((m) => m.dispose());
  MAT_CACHE.clear();
}

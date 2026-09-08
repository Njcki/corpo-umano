/**
 * Convert Female Atlas (HRA + BodyParts3D, CC BY) chunked float32 bins
 * into our quant16 catalog.json + meshes.bin format.
 *
 * Correspondence goals (Uomo ↔ Donna):
 * - Prefer shared BodyParts3D meshes with the SAME ids (FJ####) as Uomo for sex-neutral parts.
 * - Keep HRA-only female reproductive / lymphatic / unique viscera.
 * - Drop Allen brain micro-parcels and VH_F duplicates of BP3D names.
 * - No full-body tegumentario for now (no ADAPTIVE_SKIN / VH_F_skin / FJ2810);
 *   keep only small facial BP3D tegumentario (eyebrow / hair / lip).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.resolve(ROOT, 'tmp/female-atlas/public/models');
const OUT = path.resolve(ROOT, 'public/models/female');

const SYS_MAP = {
  skeletal: 'scheletrico',
  muscular: 'muscolare',
  arterial: 'circolatorio',
  venous: 'circolatorio',
  cardiac: 'circolatorio',
  nervous: 'nervoso',
  sensory: 'nervoso',
  respiratory: 'respiratorio',
  digestive: 'digestivo',
  urinary: 'urinario',
  reproductive: 'urinario',
  pregnancy: 'urinario',
  lymphatic: 'linfatico',
  integumentary: 'tegumentario',
  endocrine: 'organi',
  connective: 'organi',
};

const SWAP = [
  [/Right\b/gi, 'Destro'], [/Left\b/gi, 'Sinistro'],
  [/right\b/g, 'destro'], [/left\b/g, 'sinistro'],
  [/muscle\b/gi, 'muscolo'], [/muscles\b/gi, 'muscoli'],
  [/bone\b/gi, 'osso'], [/bones\b/gi, 'ossa'],
  [/artery\b/gi, 'arteria'], [/arteries\b/gi, 'arterie'],
  [/vein\b/gi, 'vena'], [/veins\b/gi, 'vene'],
  [/nerve\b/gi, 'nervo'], [/nerves\b/gi, 'nervi'],
  [/gland\b/gi, 'ghiandola'], [/skin\b/gi, 'cute'],
  [/heart\b/gi, 'cuore'], [/lung\b/gi, 'polmone'], [/lungs\b/gi, 'polmoni'],
  [/liver\b/gi, 'fegato'], [/kidney\b/gi, 'rene'], [/brain\b/gi, 'cervello'],
  [/stomach\b/gi, 'stomaco'], [/vertebra\b/gi, 'vertebra'],
  [/rib\b/gi, 'costa'], [/breast\b/gi, 'mammella'],
  [/uterus\b/gi, 'utero'], [/ovary\b/gi, 'ovaio'], [/vagina\b/gi, 'vagina'],
  [/of\b/g, 'di'], [/and\b/g, 'e'], [/the\b/gi, ''],
  [/Upper\b/g, 'Superiore'], [/Lower\b/g, 'Inferiore'],
];

function toItalian(en) {
  let s = en || 'Struttura anatomica';
  for (const [re, rep] of SWAP) s = s.replace(re, rep);
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function quantize(positions) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    if (x < minX) minX = x; if (y < minY) minY = y; if (z < minZ) minZ = z;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y; if (z > maxZ) maxZ = z;
  }
  const sx = maxX === minX ? 1 : (maxX - minX) / 65535;
  const sy = maxY === minY ? 1 : (maxY - minY) / 65535;
  const sz = maxZ === minZ ? 1 : (maxZ - minZ) / 65535;
  const q = new Uint16Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    q[i] = Math.round((positions[i] - minX) / sx);
    q[i + 1] = Math.round((positions[i + 1] - minY) / sy);
    q[i + 2] = Math.round((positions[i + 2] - minZ) / sz);
  }
  return { q, min: [minX, minY, minZ], scale: [sx, sy, sz] };
}

function normalizePartId(id) {
  if (id.startsWith('BP3D_')) return id.slice(5);
  return id;
}

/**
 * Exclude meshes that cannot sit coherently / break Uomo↔Donna parity.
 */
function shouldExclude(p, bp3dNames) {
  const id = p.id || '';
  const name = (p.name || '').toLowerCase();
  const system = p.system || '';
  const enKey = (p.name || '').toLowerCase().trim();

  if (system === 'pregnancy') return 'pregnancy';
  if (/placenta|umbilical|amnion|chorionic|basal plate|chorionic plate/.test(name)) return 'pregnancy';
  if (/placenta|umbilical|amnion|chorionic|basal_plate/.test(id)) return 'pregnancy';

  // Full-body skin omitted for Donna (cute non inclusa per ora)
  if (id === 'VH_F_skin') return 'hra-skin-omitted';

  // Male BP3D full-body skin — never in Donna
  if (id === 'BP3D_FJ2810' || id === 'FJ2810') return 'male-bp3d-skin';
  if ((id.startsWith('BP3D') || id.startsWith('FJ')) && /^(skin|cute)$/i.test((p.name || '').trim())) {
    return 'male-bp3d-skin';
  }
  if (/prostate|testis|penis|scrotum|epididymis|spermatic|seminal vesicle|ductus deferens|foreskin|glans|corpus cavernosum|corpus spongiosum|scrotal|prepuce|ejaculat|bulbourethral/i.test((p.name || '') + ' ' + id)) {
    return 'male-genitalia';
  }

  // Allen brain micro-parcels → oversplitting vs Uomo (~100 nervoso)
  if (id.startsWith('Allen') || id.startsWith('Allen_')) return 'allen-brain-oversplit';

  // Prefer shared BP3D for sex-neutral name collisions
  if (id.startsWith('VH_F') && bp3dNames.has(enKey)) return 'vhf-bp3d-name-dup';

  // VH_F vessel / lung segment oversplit — BP3D already covers these systems
  if (id.startsWith('VH_F') && (system === 'arterial' || system === 'venous' || system === 'cardiac')) {
    return 'vhf-vessel-oversplit';
  }
  if (id.startsWith('VH_F') && system === 'respiratory') {
    // keep nothing from HRA respiratory (neck cartilages come from BP3D; trachea align not needed)
    return 'vhf-resp-oversplit';
  }

  if (id.startsWith('VH_F') && system === 'skeletal') return 'hra-skeleton-dup';
  if (id.startsWith('VH_F') && /vertebra|sacrum|coccyx|ilium|ischium|pubis|femur|tibia|fibula|patella|condyle/.test(name)) {
    return 'hra-skeleton-dup';
  }

  if (id.startsWith('VH_F') && /cruciate|meniscus|anterolateral ligament|quadriceps femoris|perichondular|enthesis|trochlear/.test(name)) {
    return 'hra-knee-fragment';
  }
  if (id.startsWith('VH_F') && /rectus femoris/.test(name)) return 'hra-muscle-dup';

  if (id.startsWith('VH_F') && system === 'sensory') return 'hra-eye-misaligned';
  if (id.startsWith('VH_F') && /sclera|cornea|iris|lens|pupil|vitreous|choroid|retina|aqueous|eyelid|conjunctiva|optic disc|optic_choroid|trabecular_meshwork|schlemm|corneo_scleral|suspensory_ligament_of_lens|optic_nerve|optic_chiasm/.test(name + ' ' + id)) {
    return 'hra-eye-misaligned';
  }
  if (id.startsWith('VH_F') && /extraocular|rectus_extraocular|oblique_extraocular/.test(name + ' ' + id)) {
    return 'hra-eye-misaligned';
  }
  // Orbit vessels without HRA eyes → float on forehead / face
  if (/ophthalm|opthalm|ciliary_artery|posterior_ciliary/.test(id + ' ' + name)) {
    return 'orbit-vessel-no-eye';
  }

  // Round ligaments of uterus: L/R swapped vs ovaries and Z sticks anterior of pelvis
  if (/round_ligament_of_uterus|round ligament of uterus/.test(id + ' ' + name)) {
    return 'pelvic-ligament-outlier';
  }

  if (id === 'VH_F_cricoid_cartilage' || id === 'VH_F_thyroid_cartilage') return 'hra-neck-dup';
  if (id.startsWith('VH_F') && /^(cricoid cartilage|thyroid cartilage)$/.test(name)) return 'hra-neck-dup';

  return null;
}

const HRA_NECK_ALIGN = [0.009, 0.005, -0.017];

function isPelvicLigament(p) {
  const id = p.id || '';
  const name = (p.name || '').toLowerCase();
  if (!id.startsWith('VH_F')) return false;
  return /uterosacral|cardinal_ligament|broad_ligament|ovarian_ligament|suspensory_ligament_of_ovary/.test(id)
    || /uterosacral|cardinal ligament|broad ligament|ovarian ligament|suspensory ligament of ovary/.test(name);
}

function clampPelvicLigamentZ(positions, zMin, zMax) {
  let minZ = Infinity, maxZ = -Infinity;
  for (let i = 2; i < positions.length; i += 3) {
    if (positions[i] < minZ) minZ = positions[i];
    if (positions[i] > maxZ) maxZ = positions[i];
  }
  let dz = 0;
  if (maxZ > zMax) dz = zMax - maxZ;
  if (minZ + dz < zMin) dz = zMin - minZ;
  if (dz !== 0) {
    for (let i = 2; i < positions.length; i += 3) positions[i] += dz;
  }
}

function needsNeckAlign(p) {
  if (!p.id || !p.id.startsWith('VH_F')) return false;
  const name = (p.name || '').toLowerCase();
  const id = p.id;
  return /trachea|tracheal|arytenoid|epiglot|corniculate|carina|main_bronchus|bronchus/.test(id)
    || /\b(trachea|tracheal|arytenoid|epiglot|corniculate|carina|bronchus)\b/.test(name);
}


function emptyAabb() {
  return { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
}

function aabbOf(positions) {
  const a = emptyAabb();
  expandAabb(a, positions);
  return a;
}

function expandAabb(acc, positions) {
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    if (x < acc.min[0]) acc.min[0] = x; if (y < acc.min[1]) acc.min[1] = y; if (z < acc.min[2]) acc.min[2] = z;
    if (x > acc.max[0]) acc.max[0] = x; if (y > acc.max[1]) acc.max[1] = y; if (z > acc.max[2]) acc.max[2] = z;
  }
}

function aabbValid(a) {
  return Number.isFinite(a.min[0]) && Number.isFinite(a.max[0]);
}

function aabbCenter(a) {
  return [
    (a.min[0] + a.max[0]) * 0.5,
    (a.min[1] + a.max[1]) * 0.5,
    (a.min[2] + a.max[2]) * 0.5,
  ];
}

function aabbSize(a) {
  return [a.max[0] - a.min[0], a.max[1] - a.min[1], a.max[2] - a.min[2]];
}

function mergeAabb(a, b) {
  if (!aabbValid(b)) return a;
  if (!aabbValid(a)) {
    a.min = b.min.slice();
    a.max = b.max.slice();
    return a;
  }
  for (let k = 0; k < 3; k++) {
    if (b.min[k] < a.min[k]) a.min[k] = b.min[k];
    if (b.max[k] > a.max[k]) a.max[k] = b.max[k];
  }
  return a;
}

function inflateAabb(a, pad) {
  return {
    min: [a.min[0] - pad, a.min[1] - pad * 0.35, a.min[2] - pad],
    max: [a.max[0] + pad, a.max[1] + pad * 0.35, a.max[2] + pad],
  };
}

/** Classify BP3D / HRA part into landmark region for adaptive envelope. */
function regionKeyForPart(p, sistema) {
  const name = (p.name || '').toLowerCase();
  const id = (p.id || '').toLowerCase();
  const n = name + ' ' + id;
  if (sistema === 'tegumentario') return null;

  const isLeft = /\bleft\b|\bsinistr/.test(n);
  const isRight = /\bright\b|\bdestr/.test(n);

  if (/skull|cranium|mandible|maxilla|frontal bone|occipital|parietal bone|temporal bone|zygomatic|nasal bone|sphenoid|ethmoid|hyoid/.test(n)) {
    return 'head';
  }
  if (/hip bone|\bsacrum\b|\bcoccyx\b|\bilium\b|\bischium\b|\bpubis\b|innominate/.test(n)) {
    return 'pelvis';
  }

  // Limb targets = long bones (+ feet/hands) ONLY — soft-tissue names collide (flexor/extensor/adductor)
  const armBone = /\bhumerus\b|\bradius\b|\bulna\b/.test(n)
    || /carpal bone|metacarpal|phalanx.*(hand|finger|thumb)|bones? of (the )?hand/.test(n);
  const legBone = /\bfemur\b|\btibia\b|\bfibula\b|\bpatella\b|calcaneus|\btalus\b/.test(n)
    || /tarsal bone|metatarsal|phalanx.*toe|bones? of (the )?foot/.test(n);

  if (armBone) {
    if (isLeft && !isRight) return 'lArm';
    if (isRight && !isLeft) return 'rArm';
  }
  if (legBone) {
    if (isLeft && !isRight) return 'lLeg';
    if (isRight && !isLeft) return 'rLeg';
  }

  // Axial torso only — ribs/sternum/vertebrae (+ scapula/clavicle for shoulder breadth, not arm span)
  if (/sternum|\brib\b|costa|clavicle|scapula|vertebra|vertebral|disc|thoracic|lumbar|cervical/.test(n)) {
    return 'torso';
  }
  // Core trunk muscles (not limb)
  if (/pectoralis|rectus abdominis|obliquus|transversus abdominis|latissimus|trapezius|erector|multifidus|intercostal|diaphragm|serratus anterior|rhomboid/.test(n)) {
    return 'torso';
  }

  // Organs / viscera for hull — exclude named limb vessels later via AABB clamp if needed
  if (sistema === 'respiratorio' || sistema === 'digestivo'
    || sistema === 'urinario' || sistema === 'organi' || sistema === 'linfatico') {
    return 'organs';
  }
  // Cardiac / central vessels only loosely; skip peripheral limb arteries from organs box
  if (sistema === 'circolatorio') {
    if (/heart|aorta|vena cava|pulmonary|coronary|atrium|ventricle/.test(n)) return 'organs';
    return null;
  }
  return null;
}

function sampleHullPoints(positions, out, stride) {
  const n = Math.floor(positions.length / 3);
  const step = Math.max(1, stride | 0);
  for (let i = 0; i < n; i += step) {
    const o = i * 3;
    out.push(positions[o], positions[o + 1], positions[o + 2]);
  }
}

/**
 * Adaptive tegumentario envelope ("involucro adattivo"):
 * cylindrical/elliptical radial field along height for head+torso,
 * dual-leg columns below pelvis, plus limb tubes for arms —
 * inflated ~1.5 cm outside internals. Educational silhouette, not dermis.
 */
function fillEmptyBins1D(arr, cols) {
  const rows = arr.length / cols;
  for (let pass = 0; pass < 3; pass++) {
    const copy = Float32Array.from(arr);
    for (let yi = 0; yi < rows; yi++) {
      for (let ti = 0; ti < cols; ti++) {
        const idx = yi * cols + ti;
        if (copy[idx] > 1e-6) continue;
        let best = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dt = -1; dt <= 1; dt++) {
            const yy = yi + dy;
            if (yy < 0 || yy >= rows) continue;
            const tt = (ti + dt + cols) % cols;
            best = Math.max(best, copy[yy * cols + tt]);
          }
        }
        arr[idx] = best;
      }
    }
  }
}

function smoothField(arr, cols, passes = 1) {
  const rows = arr.length / cols;
  for (let p = 0; p < passes; p++) {
    const copy = Float32Array.from(arr);
    for (let yi = 0; yi < rows; yi++) {
      for (let ti = 0; ti < cols; ti++) {
        let s = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dt = -1; dt <= 1; dt++) {
            const yy = yi + dy;
            if (yy < 0 || yy >= rows) continue;
            const tt = (ti + dt + cols) % cols;
            const v = copy[yy * cols + tt];
            if (v > 1e-6) { s += v; n++; }
          }
        }
        if (n) arr[yi * cols + ti] = s / n;
      }
    }
  }
}

function appendTube(positions, indices, a, b, radiusTop, radiusBot, segs = 12, rings = 10) {
  const ax = a[0], ay = a[1], az = a[2];
  const bx = b[0], by = b[1], bz = b[2];
  let dx = bx - ax, dy = by - ay, dz = bz - az;
  const len = Math.hypot(dx, dy, dz) || 1e-6;
  dx /= len; dy /= len; dz /= len;
  // orthonormal basis
  let ux, uy, uz;
  if (Math.abs(dy) < 0.9) { ux = dy; uy = -dx; uz = 0; }
  else { ux = 0; uy = -dz; uz = dy; }
  let ul = Math.hypot(ux, uy, uz) || 1;
  ux /= ul; uy /= ul; uz /= ul;
  let vx = dy * uz - dz * uy;
  let vy = dz * ux - dx * uz;
  let vz = dx * uy - dy * ux;
  let vl = Math.hypot(vx, vy, vz) || 1;
  vx /= vl; vy /= vl; vz /= vl;

  const base = positions.length / 3;
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const cx = ax + dx * len * t;
    const cy = ay + dy * len * t;
    const cz = az + dz * len * t;
    const rad = radiusTop + (radiusBot - radiusTop) * t;
    for (let j = 0; j < segs; j++) {
      const ang = (j / segs) * Math.PI * 2;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      positions.push(
        cx + (ux * ca + vx * sa) * rad,
        cy + (uy * ca + vy * sa) * rad,
        cz + (uz * ca + vz * sa) * rad,
      );
    }
  }
  // caps centers
  const topC = base + (rings + 1) * segs;
  const botC = topC + 1;
  positions.push(ax, ay, az, bx, by, bz);
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segs; j++) {
      const j2 = (j + 1) % segs;
      const a0 = base + i * segs + j;
      const a1 = base + i * segs + j2;
      const b0 = base + (i + 1) * segs + j;
      const b1 = base + (i + 1) * segs + j2;
      indices.push(a0, b0, a1, a1, b0, b1);
    }
  }
  for (let j = 0; j < segs; j++) {
    const j2 = (j + 1) % segs;
    indices.push(topC, base + j2, base + j);
    const botRing = base + rings * segs;
    indices.push(botC, botRing + j, botRing + j2);
  }
}

function appendRadialShell(positions, indices, y0, y1, cx, cz, field, fieldY0, fieldY1, yBins, thBins, closeTop, closeBot, ringsOverride) {
  const rings = ringsOverride || Math.max(8, Math.round(yBins * Math.max(0.08, (y1 - y0) / Math.max(1e-6, fieldY1 - fieldY0))));
  const base = positions.length / 3;
  const fSpan = Math.max(1e-6, fieldY1 - fieldY0);
  for (let yi = 0; yi <= rings; yi++) {
    const fy = yi / rings;
    const y = y0 + (y1 - y0) * fy;
    const globalFy = (y - fieldY0) / fSpan;
    const row = Math.max(0, Math.min(yBins - 1, Math.floor(Math.max(0, Math.min(0.9999, globalFy)) * yBins)));
    for (let ti = 0; ti < thBins; ti++) {
      const ang = -Math.PI + ((ti + 0.5) / thBins) * Math.PI * 2;
      let r = 0;
      for (let dt = -1; dt <= 1; dt++) {
        const tt = (ti + dt + thBins) % thBins;
        r = Math.max(r, field[row * thBins + tt]);
        if (row > 0) r = Math.max(r, field[(row - 1) * thBins + tt]);
        if (row + 1 < yBins) r = Math.max(r, field[(row + 1) * thBins + tt]);
      }
      if (r < 1e-4) r = 0.02;
      positions.push(cx + Math.cos(ang) * r, y, cz + Math.sin(ang) * r);
    }
  }
  for (let yi = 0; yi < rings; yi++) {
    for (let ti = 0; ti < thBins; ti++) {
      const ti2 = (ti + 1) % thBins;
      const a0 = base + yi * thBins + ti;
      const a1 = base + yi * thBins + ti2;
      const b0 = base + (yi + 1) * thBins + ti;
      const b1 = base + (yi + 1) * thBins + ti2;
      indices.push(a0, b0, a1, a1, b0, b1);
    }
  }
  if (closeTop) {
    const topC = positions.length / 3;
    positions.push(cx, y1, cz);
    const ring = base + rings * thBins;
    for (let ti = 0; ti < thBins; ti++) {
      const ti2 = (ti + 1) % thBins;
      indices.push(topC, ring + ti2, ring + ti);
    }
  }
  if (closeBot) {
    const botC = positions.length / 3;
    positions.push(cx, y0, cz);
    const ring = base;
    for (let ti = 0; ti < thBins; ti++) {
      const ti2 = (ti + 1) % thBins;
      indices.push(botC, ring + ti, ring + ti2);
    }
  }
}

function buildAdaptiveEnvelope(bodyAabb, regions, hullSamples) {
  const INFLATE = 0.016; // ~1.6 cm outside internals
  const Y_BINS = 72;
  const TH_BINS = 48;
  const samples = hullSamples.length >= 200 ? hullSamples : null;
  if (!aabbValid(bodyAabb)) {
    throw new Error('bodyAabb invalid — cannot build adaptive envelope');
  }

  const tmin = bodyAabb.min.slice();
  const tmax = bodyAabb.max.slice();
  // slight pad on Y so head/feet caps clear
  tmin[1] -= INFLATE * 0.6;
  tmax[1] += INFLATE * 0.8;
  const ySpan = Math.max(1e-6, tmax[1] - tmin[1]);
  const midX = (tmin[0] + tmax[0]) * 0.5;
  const midZ = (tmin[2] + tmax[2]) * 0.5;

  const torso = aabbValid(regions.torso) ? regions.torso : bodyAabb;
  const pelvis = aabbValid(regions.pelvis) ? regions.pelvis : torso;
  const head = aabbValid(regions.head) ? regions.head : null;
  const hipY = (pelvis.min[1] + pelvis.max[1]) * 0.5;
  const crotchY = Math.min(hipY - 0.02, pelvis.min[1] + 0.02);
  const neckY = head ? head.min[1] * 0.7 + head.max[1] * 0.3 : tmin[1] + ySpan * 0.82;

  // --- Main trunk+head radial field (exclude far lateral arm samples) ---
  const armGateX = Math.max(
    Math.abs(torso.min[0]), Math.abs(torso.max[0]),
    Math.abs(pelvis.min[0]), Math.abs(pelvis.max[0]),
    0.12,
  ) * 1.15;
  const fieldTrunk = new Float32Array(Y_BINS * TH_BINS);
  if (samples) {
    for (let i = 0; i < samples.length; i += 3) {
      const x = samples[i], y = samples[i + 1], z = samples[i + 2];
      if (y < crotchY - 0.02) continue; // legs handled separately
      // Skip extreme arm outliers for trunk field
      if (y > crotchY && y < neckY + 0.05 && Math.abs(x) > armGateX * 1.35) continue;
      const fy = (y - tmin[1]) / ySpan;
      if (fy < -0.02 || fy > 1.02) continue;
      const yi = Math.max(0, Math.min(Y_BINS - 1, Math.floor(fy * Y_BINS)));
      const ang = Math.atan2(z - midZ, x - midX);
      const ti = Math.max(0, Math.min(TH_BINS - 1, Math.floor(((ang + Math.PI) / (2 * Math.PI)) * TH_BINS)));
      const r = Math.hypot(x - midX, z - midZ);
      const idx = yi * TH_BINS + ti;
      if (r > fieldTrunk[idx]) fieldTrunk[idx] = r;
    }
  }
  fillEmptyBins1D(fieldTrunk, TH_BINS);
  // Minimum radii so silhouette never collapses (neck thinner, torso fuller)
  for (let yi = 0; yi < Y_BINS; yi++) {
    const fy = (yi + 0.5) / Y_BINS;
    const y = tmin[1] + fy * ySpan;
    let minR;
    if (y >= neckY) minR = 0.07;
    else if (y >= hipY) minR = 0.11;
    else minR = 0.09;
    for (let ti = 0; ti < TH_BINS; ti++) {
      const idx = yi * TH_BINS + ti;
      fieldTrunk[idx] = Math.max(fieldTrunk[idx], minR) + INFLATE;
    }
  }
  smoothField(fieldTrunk, TH_BINS, 2);

  // --- Dual leg radial fields ---
  function legField(legAabb) {
    const f = new Float32Array(Y_BINS * TH_BINS);
    if (!aabbValid(legAabb)) return { f, cx: midX, cz: midZ, y0: tmin[1], y1: crotchY };
    const cx = (legAabb.min[0] + legAabb.max[0]) * 0.5;
    const cz = (legAabb.min[2] + legAabb.max[2]) * 0.5;
    const y0 = Math.min(legAabb.min[1], tmin[1]) - INFLATE * 0.3;
    const y1 = Math.max(crotchY + 0.04, legAabb.max[1] * 0.15 + crotchY * 0.85);
    if (samples) {
      for (let i = 0; i < samples.length; i += 3) {
        const x = samples[i], y = samples[i + 1], z = samples[i + 2];
        if (y < y0 - 0.02 || y > y1 + 0.05) continue;
        // keep samples nearer this leg
        if (Math.abs(x - cx) > Math.abs(x - midX) + 0.04 && Math.sign(x) !== Math.sign(cx - midX) && Math.abs(cx - midX) > 0.02) {
          // opposite side
          if (Math.sign(x - midX) !== Math.sign(cx - midX)) continue;
        }
        if (Math.sign(cx - midX) !== 0 && Math.sign(x - midX) !== 0 && Math.sign(x - midX) !== Math.sign(cx - midX)) continue;
        const fy = (y - tmin[1]) / ySpan;
        const yi = Math.max(0, Math.min(Y_BINS - 1, Math.floor(fy * Y_BINS)));
        const ang = Math.atan2(z - cz, x - cx);
        const ti = Math.max(0, Math.min(TH_BINS - 1, Math.floor(((ang + Math.PI) / (2 * Math.PI)) * TH_BINS)));
        const r = Math.hypot(x - cx, z - cz);
        const idx = yi * TH_BINS + ti;
        if (r > f[idx]) f[idx] = r;
      }
    }
    fillEmptyBins1D(f, TH_BINS);
    for (let yi = 0; yi < Y_BINS; yi++) {
      const fy = (yi + 0.5) / Y_BINS;
      const y = tmin[1] + fy * ySpan;
      if (y < y0 - 0.01 || y > y1 + 0.02) continue;
      const ankle = y0 + (y1 - y0) * 0.08;
      const minR = y < ankle + 0.05 ? 0.035 : 0.055;
      for (let ti = 0; ti < TH_BINS; ti++) {
        const idx = yi * TH_BINS + ti;
        f[idx] = Math.max(f[idx], minR) + INFLATE;
      }
    }
    smoothField(f, TH_BINS, 2);
    return { f, cx, cz, y0, y1 };
  }

  const lLeg = legField(regions.lLeg);
  const rLeg = legField(regions.rLeg);

  const positions = [];
  const indices = [];

  // Trunk from crotch to crown
  const trunkY0 = crotchY - 0.01;
  const trunkY1 = tmax[1];
  // Remap field rows to trunk span only — reuse full field but shell uses y0/y1
  appendRadialShell(positions, indices, trunkY0, trunkY1, midX, midZ, fieldTrunk, tmin[1], tmax[1], Y_BINS, TH_BINS, true, false);

  // Legs
  if (aabbValid(regions.lLeg)) {
    appendRadialShell(positions, indices, lLeg.y0, lLeg.y1, lLeg.cx, lLeg.cz, lLeg.f, tmin[1], tmax[1], Y_BINS, TH_BINS, false, true);
  }
  if (aabbValid(regions.rLeg)) {
    appendRadialShell(positions, indices, rLeg.y0, rLeg.y1, rLeg.cx, rLeg.cz, rLeg.f, tmin[1], tmax[1], Y_BINS, TH_BINS, false, true);
  }

  // Arm tubes
  function armTube(legKey, sideSign) {
    const a = regions[legKey];
    if (!aabbValid(a)) return;
    const c = aabbCenter(a);
    const sz = aabbSize(a);
    // shoulder near top of arm AABB, wrist near bottom (or distal in Y)
    const shoulder = [
      c[0] + sideSign * sz[0] * 0.05,
      a.max[1] - Math.min(0.04, sz[1] * 0.08),
      c[2],
    ];
    const wrist = [
      c[0] + sideSign * sz[0] * 0.15,
      a.min[1] + Math.min(0.03, sz[1] * 0.05),
      c[2],
    ];
    // pull shoulder slightly toward torso
    shoulder[0] = shoulder[0] * 0.55 + midX * 0.45;
    const rShoulder = Math.max(0.045, Math.min(sz[0], sz[2]) * 0.55) + INFLATE;
    const rWrist = Math.max(0.022, rShoulder * 0.42);
    appendTube(positions, indices, shoulder, wrist, rShoulder, rWrist, 14, 12);
    // soft hand blob
    const handEnd = [wrist[0], wrist[1] - 0.04, wrist[2]];
    appendTube(positions, indices, wrist, handEnd, rWrist, rWrist * 0.85, 10, 4);
  }
  armTube('lArm', +1);
  armTube('rArm', -1);

  // Optional head dome reinforce if head AABB tall
  if (head) {
    const hc = aabbCenter(head);
    const hs = aabbSize(head);
    const top = [hc[0], head.max[1] + INFLATE * 0.5, hc[2]];
    const chin = [hc[0], head.min[1], hc[2]];
    const r = Math.max(hs[0], hs[2]) * 0.52 + INFLATE;
    appendTube(positions, indices, chin, top, r * 0.92, r * 0.7, 16, 8);
  }

  const pos = Float32Array.from(positions);
  const idx = Uint32Array.from(indices);

  // light Laplacian smooth on connected verts (skip if huge)
  if (pos.length / 3 < 80000) {
    const nV = pos.length / 3;
    const accum = new Float32Array(nV * 3);
    const counts = new Uint16Array(nV);
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      for (const [u, v] of [[a, b], [b, c], [c, a]]) {
        accum[u * 3] += pos[v * 3];
        accum[u * 3 + 1] += pos[v * 3 + 1];
        accum[u * 3 + 2] += pos[v * 3 + 2];
        counts[u]++;
      }
    }
    const smooth = 0.22;
    for (let i = 0; i < nV; i++) {
      if (!counts[i]) continue;
      const inv = 1 / counts[i];
      pos[i * 3] += (accum[i * 3] * inv - pos[i * 3]) * smooth;
      pos[i * 3 + 1] += (accum[i * 3 + 1] * inv - pos[i * 3 + 1]) * smooth;
      pos[i * 3 + 2] += (accum[i * 3 + 2] * inv - pos[i * 3 + 2]) * smooth;
    }
  }

  const after = aabbOf(pos);
  return {
    positions: pos,
    indices: idx,
    vertexCount: pos.length / 3,
    indexCount: idx.length,
    meta: {
      method: 'adaptive-envelope-v1',
      inflate: INFLATE,
      note: 'Educational body silhouette from internals (cylindrical harmonics + limb tubes); not anatomic dermis',
      bodyAabb,
      regions: {
        head: head || null,
        torso,
        pelvis,
        lArm: aabbValid(regions.lArm) ? regions.lArm : null,
        rArm: aabbValid(regions.rArm) ? regions.rArm : null,
        lLeg: aabbValid(regions.lLeg) ? regions.lLeg : null,
        rLeg: aabbValid(regions.rLeg) ? regions.rLeg : null,
      },
      envelopeAabb: after,
      hullSamples: samples ? samples.length / 3 : 0,
      yBins: Y_BINS,
      thBins: TH_BINS,
    },
  };
}

function appendQuantized(parts, binChunks, state, countsBySystem, rec) {
  const { positions, indices, id, en, sistema, bp, fma, descrizione } = rec;
  if (positions.length < 9 || indices.length < 3) return;

  const { q, min, scale } = quantize(positions);
  const use16 = rec.vertexCount <= 65535;
  const posBuf = Buffer.from(q.buffer.slice(q.byteOffset, q.byteOffset + q.byteLength));
  let idxBytes;
  if (use16) {
    const u16 = new Uint16Array(indices.length);
    for (let i = 0; i < indices.length; i++) u16[i] = indices[i];
    idxBytes = Buffer.from(u16.buffer);
  } else {
    idxBytes = Buffer.from(indices.buffer.slice(indices.byteOffset, indices.byteOffset + indices.byteLength));
  }

  const pad = (n) => (4 - (n % 4)) % 4;
  const posOffset = state.offset;
  binChunks.push(posBuf);
  state.offset += posBuf.length;
  let padv = pad(state.offset);
  if (padv) { binChunks.push(Buffer.alloc(padv)); state.offset += padv; }
  const idxOffset = state.offset;
  binChunks.push(idxBytes);
  state.offset += idxBytes.length;
  padv = pad(state.offset);
  if (padv) { binChunks.push(Buffer.alloc(padv)); state.offset += padv; }

  countsBySystem[sistema] = (countsBySystem[sistema] || 0) + 1;
  parts.push({
    id,
    bp: bp || id,
    fma: fma || '',
    nome: toItalian(en),
    en,
    latino: en,
    sistema,
    descrizione,
    vertexCount: rec.vertexCount,
    indexCount: rec.indexCount,
    posOffset,
    posBytes: posBuf.length,
    idxOffset,
    idxBytes: idxBytes.length,
    posEncoding: 'quant16',
    idxEncoding: use16 ? 'u16' : 'u32',
    indexSize: use16 ? 2 : 4,
    quantMin: min,
    quantScale: scale,
  });
}

const atlas = JSON.parse(fs.readFileSync(path.join(SRC, 'atlas.json'), 'utf8'));
fs.mkdirSync(OUT, { recursive: true });

const bp3dNames = new Set();
for (const p of atlas.parts) {
  if ((p.id || '').startsWith('BP3D') || (p.id || '').startsWith('FJ')) {
    bp3dNames.add((p.name || '').toLowerCase().trim());
  }
}

const chunkBuffers = [];
for (let i = 0; i < atlas.chunks.length; i++) {
  const ch = atlas.chunks[i];
  const binPath = path.join(SRC, path.basename(ch.url));
  const gzPath = ch.gzip ? path.join(SRC, path.basename(ch.gzip)) : null;
  let buf;
  if (fs.existsSync(binPath) && fs.statSync(binPath).size === ch.bytes) {
    buf = fs.readFileSync(binPath);
  } else if (gzPath && fs.existsSync(gzPath)) {
    buf = zlib.gunzipSync(fs.readFileSync(gzPath));
  } else {
    throw new Error('Missing chunk ' + i);
  }
  if (buf.length !== ch.bytes) console.warn('chunk size mismatch', i, buf.length, ch.bytes);
  chunkBuffers[i] = buf;
  console.log('chunk', i, buf.length);
}

const parts = [];
const binChunks = [];
const state = { offset: 0 };
const countsBySystem = {};
const excluded = {};
const skelAabb = emptyAabb();
const bodyAabb = emptyAabb(); // non-tegumentario envelope
const regions = {
  head: emptyAabb(),
  torso: emptyAabb(),
  pelvis: emptyAabb(),
  lArm: emptyAabb(),
  rArm: emptyAabb(),
  lLeg: emptyAabb(),
  rLeg: emptyAabb(),
  organs: emptyAabb(),
};
const hullSamples = [];

const LIMIT = Number(process.env.LIMIT || 0);
const srcParts = LIMIT > 0 ? atlas.parts.slice(0, LIMIT) : atlas.parts;

// First pass: collect skeletal/muscular/organ bounds + hull samples for skin morph
const pending = [];
for (let pi = 0; pi < srcParts.length; pi++) {
  const p = srcParts[pi];
  const reason = shouldExclude(p, bp3dNames);
  if (reason) {
    excluded[reason] = (excluded[reason] || 0) + 1;
    continue;
  }

  const buf = chunkBuffers[p.chunk];
  const positions = new Float32Array(buf.buffer, buf.byteOffset + p.positions, p.vertexCount * 3);
  const posCopy = new Float32Array(positions);
  const indices = new Uint32Array(buf.buffer, buf.byteOffset + p.indices, p.indexCount);
  const idxCopy = new Uint32Array(indices);

  if (posCopy.length < 9 || idxCopy.length < 3) continue;

  if (needsNeckAlign(p)) {
    const [tx, ty, tz] = HRA_NECK_ALIGN;
    for (let i = 0; i < posCopy.length; i += 3) {
      posCopy[i] += tx;
      posCopy[i + 1] += ty;
      posCopy[i + 2] += tz;
    }
  }

  // Pull pelvic ligaments back into bony pelvis envelope (hip/sacrum Z)
  if (isPelvicLigament(p)) {
    clampPelvicLigamentZ(posCopy, -0.155, -0.02);
  }

  const sistema = SYS_MAP[p.system] || 'organi';
  if (sistema !== 'tegumentario') {
    expandAabb(bodyAabb, posCopy);
  }
  if (sistema === 'scheletrico' || sistema === 'muscolare') {
    expandAabb(skelAabb, posCopy);
  }

  const rk = regionKeyForPart(p, sistema);
  if (rk && regions[rk]) {
    expandAabb(regions[rk], posCopy);
  }

  // Hull samples: prefer bone/muscle (dense outer), then organs (stride larger)
  if (sistema === 'scheletrico') {
    sampleHullPoints(posCopy, hullSamples, Math.max(8, Math.floor(p.vertexCount / 80)));
  } else if (sistema === 'muscolare') {
    sampleHullPoints(posCopy, hullSamples, Math.max(12, Math.floor(p.vertexCount / 60)));
  } else if (
    sistema === 'respiratorio' || sistema === 'digestivo' || sistema === 'urinario'
    || sistema === 'organi' || sistema === 'circolatorio'
  ) {
    sampleHullPoints(posCopy, hullSamples, Math.max(24, Math.floor(p.vertexCount / 40)));
  }

  pending.push({
    p,
    posCopy,
    idxCopy,
    sistema,
  });
}

// Morph target: musculo-skeletal preferred; fall back to full non-tegument body
const morphTarget = aabbValid(skelAabb) ? skelAabb : bodyAabb;
console.log('kept pending', pending.length, 'skel aabb', skelAabb);
// Cap hull for morph performance (~120k pts)
if (hullSamples.length / 3 > 120000) {
  const pts = hullSamples.length / 3;
  const keep = 120000;
  const step = pts / keep;
  const capped = [];
  for (let i = 0; i < keep; i++) {
    const j = Math.floor(i * step) * 3;
    capped.push(hullSamples[j], hullSamples[j + 1], hullSamples[j + 2]);
  }
  hullSamples.length = 0;
  hullSamples.push(...capped);
}
console.log('body aabb', bodyAabb, 'hull samples', hullSamples.length / 3);
console.log('regions', Object.fromEntries(
  Object.entries(regions).map(([k, a]) => [k, aabbValid(a) ? { min: a.min, max: a.max } : null]),
));

for (let i = 0; i < pending.length; i++) {
  const { p, posCopy, idxCopy, sistema } = pending[i];
  const id = normalizePartId(p.id);
  appendQuantized(parts, binChunks, state, countsBySystem, {
    positions: posCopy,
    indices: idxCopy,
    vertexCount: p.vertexCount,
    indexCount: p.indexCount,
    id,
    en: p.name,
    sistema,
    bp: p.conceptId || id,
    fma: (p.conceptId || '').startsWith('FMA') ? p.conceptId : '',
    descrizione: `Mesh anatomica femminile (HRA / BodyParts3D): ${p.name}`,
  });
  if ((i + 1) % 200 === 0) console.log('packed', i + 1, '/', pending.length);
}

// Full-body cute / involucro adattivo omitted for now (eyebrow/hair/lip kept via BP3D tegumentario)
console.log('Skipping full-body tegumentario (cute non inclusa per ora)');

const catalog = {
  source: 'Human Reference Atlas (HuBMAP) + BodyParts3D via Female Atlas packing',
  sourceUrl: 'https://humanatlas.io/3d-reference-library',
  license: 'CC BY 4.0 (HRA organs) / BodyParts3D (DBCLS) as packaged in Female Atlas; cute full-body non inclusa per ora',
  attribution:
    'Donna: Human Reference Atlas / HuBMAP CC BY 4.0 + BodyParts3D DBCLS; cute full-body non inclusa per ora; packing Female Atlas (MIT)',
  version: atlas.version || '2.0',
  species: 'donna',
  sex: 'female',
  count: parts.length,
  countsBySystem,
  bin: 'meshes.bin',
  notes:
    'Corrispondenza Uomo: id BP3D normalizzati (FJ####). Allen brain escluso; VH_F duplicati/vasi/polmoni ridotti. Cute full-body non inclusa (ADAPTIVE_SKIN / VH_F_skin / FJ2810 omessi); restano solo eyebrow/hair/lip BP3D. Riproduttivo/linfatico HRA = differenze di sesso/dataset.',
  excluded,
  hraNeckAlign: HRA_NECK_ALIGN,
  parts,
};

fs.writeFileSync(path.join(OUT, 'catalog.json'), JSON.stringify(catalog));
fs.writeFileSync(path.join(OUT, 'meshes.bin'), Buffer.concat(binChunks));
console.log('Wrote', parts.length, 'parts,', (state.offset / 1e6).toFixed(2), 'MB');
console.log('counts', countsBySystem);
console.log('excluded', excluded);

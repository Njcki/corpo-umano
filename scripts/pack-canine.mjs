/**
 * Pack VT-ARIES Canine GLBs into catalog.json + meshes.bin (quant16),
 * same layout as BodyParts3D pack for the human explorer.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { NodeIO } from '@gltf-transform/core';
import { getBounds } from '@gltf-transform/functions';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.resolve(ROOT, 'tmp/vt-anatomy/models/Canine');
const OUT = path.resolve(ROOT, 'public/models/canine');

// VT viewer: MODEL_SCALE 0.1 * Canine.scale 0.032
const SCALE = 0.1 * 0.032;

const BONES = [
  'Neck/Basihyoid','Neck/C1_Atlas','Neck/C2_Axis','Neck/C3','Neck/C4','Neck/C5','Neck/C6','Neck/C7',
  'Neck/Ceratohyoid','Neck/Epihyoid','Neck/Stylohyoid','Neck/Thyrohyoid',
  'Skull/Mandible','Skull/Skull',
  'Spine/Anticlinical_Vertebra','Spine/Lumbar_Vertebrae','Spine/Thoracic_Vertebrae',
  'Pelvis_Tail/Caudal_Vertebrae','Pelvis_Tail/Caudal_Vertebrae1','Pelvis_Tail/Caudal_Vertebrae2',
  'Pelvis_Tail/Caudal_Vertebrae3','Pelvis_Tail/Caudal_Vertebrae4','Pelvis_Tail/Caudal_Vertebrae5',
  'Pelvis_Tail/Caudal_Vertebrae6','Pelvis_Tail/Caudal_Vertebrae7','Pelvis_Tail/Caudal_Vertebrae8',
  'Pelvis_Tail/Caudal_Vertebrae9','Pelvis_Tail/Caudal_Vertebrae10','Pelvis_Tail/Caudal_Vertebrae11',
  'Pelvis_Tail/Caudal_Vertebrae12','Pelvis_Tail/Caudal_Vertebrae13','Pelvis_Tail/Caudal_Vertebrae14',
  'Pelvis_Tail/Caudal_Vertebrae15','Pelvis_Tail/Caudal_Vertebrae16','Pelvis_Tail/Caudal_Vertebrae17',
  'Pelvis_Tail/Caudal_Vertebrae18','Pelvis_Tail/Os_Coxae','Pelvis_Tail/Sacrum',
  'Legs/Left_Back/Calcaneus','Legs/Left_Back/Central_Tarsal','Legs/Left_Back/Femur','Legs/Left_Back/Fibula',
  'Legs/Left_Back/Distal_Phalanges','Legs/Left_Back/Middle_Phalanges','Legs/Left_Back/Proximal_Phalanges',
  'Legs/Left_Back/Proximal_Sesamoid','Legs/Left_Back/Metatarsal_I','Legs/Left_Back/Metatarsal_II',
  'Legs/Left_Back/Metatarsal_III','Legs/Left_Back/Metatarsal_IV','Legs/Left_Back/Metatarsal_V',
  'Legs/Left_Back/Patella','Legs/Left_Back/Tarsal_I','Legs/Left_Back/Tarsal_II','Legs/Left_Back/Tarsal_III',
  'Legs/Left_Back/Tarsal_IV','Legs/Left_Back/Tibia','Legs/Left_Back/Trochlea',
  'Legs/Right_Back/Calcaneus','Legs/Right_Back/Central_Tarsal','Legs/Right_Back/Femur','Legs/Right_Back/Fibula',
  'Legs/Right_Back/Distal_Phalanges','Legs/Right_Back/Middle_Phalanges','Legs/Right_Back/Proximal_Phalanges',
  'Legs/Right_Back/Proximal_Sesamoid','Legs/Right_Back/Metatarsal_I','Legs/Right_Back/Metatarsal_II',
  'Legs/Right_Back/Metatarsal_III','Legs/Right_Back/Metatarsal_IV','Legs/Right_Back/Metatarsal_V',
  'Legs/Right_Back/Patella','Legs/Right_Back/Tarsal_I','Legs/Right_Back/Tarsal_II','Legs/Right_Back/Tarsal_III',
  'Legs/Right_Back/Tarsal_IV','Legs/Right_Back/Tibia','Legs/Right_Back/Trochlea',
  'Legs/Left_Front/Accessory_Carpal','Legs/Left_Front/Distal_Carpal_I','Legs/Left_Front/Distal_Carpal_II',
  'Legs/Left_Front/Distal_Carpal_III','Legs/Left_Front/Distal_Carpal_IV','Legs/Left_Front/Ulnar',
  'Legs/Left_Front/Ulna','Legs/Left_Front/Distal_Phalanges','Legs/Left_Front/Middle_Phalanges',
  'Legs/Left_Front/Proximal_Phalanges','Legs/Left_Front/Proximal_Sesamoid','Legs/Left_Front/Humerus',
  'Legs/Left_Front/Metacarpal_I','Legs/Left_Front/Metacarpal_II','Legs/Left_Front/Metacarpal_III',
  'Legs/Left_Front/Metacarpal_IV','Legs/Left_Front/Metacarpal_V','Legs/Left_Front/Radial',
  'Legs/Left_Front/Radius','Legs/Left_Front/Scapula',
  'Legs/Right_Front/Accessory_Carpal','Legs/Right_Front/Distal_Carpal_I','Legs/Right_Front/Distal_Carpal_II',
  'Legs/Right_Front/Distal_Carpal_III','Legs/Right_Front/Distal_Carpal_IV','Legs/Right_Front/Ulnar',
  'Legs/Right_Front/Ulna','Legs/Right_Front/Distal_Phalanges','Legs/Right_Front/Middle_Phalanges',
  'Legs/Right_Front/Proximal_Phalanges','Legs/Right_Front/Proximal_Sesamoid','Legs/Right_Front/Humerus',
  'Legs/Right_Front/Metacarpal_I','Legs/Right_Front/Metacarpal_II','Legs/Right_Front/Metacarpal_III',
  'Legs/Right_Front/Metacarpal_IV','Legs/Right_Front/Metacarpal_V','Legs/Right_Front/Radial',
  'Legs/Right_Front/Radius','Legs/Right_Front/Scapula',
  'Ribs/Ribs','Ribs/Sternebrae','Ribs/Xiphoid_Process',
  'Organs/Bladder','Organs/Duodenom','Organs/Heart','Organs/Kidneys','Organs/Large_Intestine',
  'Organs/Liver','Organs/Lungs','Organs/Small_Intestine','Organs/Spleen','Organs/Stomach',
  'Organs/Renal_Artery','Organs/Renal_Artery1','Organs/Renal_Vein','Organs/Renal_Vein1',
  'Organs/Ureter','Organs/Ureter1','Organs/Vena_Cava',
];

const IT = {
  Basihyoid: 'Basiioide', C1_Atlas: 'C1 Atlante', C2_Axis: 'C2 Epistrofeo',
  C3: 'Vertebra cervicale C3', C4: 'Vertebra cervicale C4', C5: 'Vertebra cervicale C5',
  C6: 'Vertebra cervicale C6', C7: 'Vertebra cervicale C7',
  Ceratohyoid: 'Ceratoioide', Epihyoid: 'Epiioide', Stylohyoid: 'Stiloioide', Thyrohyoid: 'Tiroioide',
  Mandible: 'Mandibola', Skull: 'Cranio',
  Anticlinical_Vertebra: 'Vertebra anticlinale', Lumbar_Vertebrae: 'Vertebre lombari',
  Thoracic_Vertebrae: 'Vertebre toraciche',
  Caudal_Vertebrae: 'Vertebra caudale', Os_Coxae: 'Osso coxale', Sacrum: 'Sacro',
  Calcaneus: 'Calcagno', Central_Tarsal: 'Tarsale centrale', Femur: 'Femore', Fibula: 'Fibula',
  Distal_Phalanges: 'Falangi distali', Middle_Phalanges: 'Falangi medie',
  Proximal_Phalanges: 'Falangi prossimali', Proximal_Sesamoid: 'Sesamoide prossimale',
  Metatarsal_I: 'Metatarso I', Metatarsal_II: 'Metatarso II', Metatarsal_III: 'Metatarso III',
  Metatarsal_IV: 'Metatarso IV', Metatarsal_V: 'Metatarso V',
  Patella: 'Rotula', Tarsal_I: 'Tarsale I', Tarsal_II: 'Tarsale II', Tarsal_III: 'Tarsale III',
  Tarsal_IV: 'Tarsale IV', Tibia: 'Tibia', Trochlea: 'Troclea',
  Accessory_Carpal: 'Carpale accessorio', Distal_Carpal_I: 'Carpale distale I',
  Distal_Carpal_II: 'Carpale distale II', Distal_Carpal_III: 'Carpale distale III',
  Distal_Carpal_IV: 'Carpale distale IV', Ulnar: 'Carpale ulnare', Ulna: 'Ulna',
  Humerus: 'Omero', Metacarpal_I: 'Metacarpo I', Metacarpal_II: 'Metacarpo II',
  Metacarpal_III: 'Metacarpo III', Metacarpal_IV: 'Metacarpo IV', Metacarpal_V: 'Metacarpo V',
  Radial: 'Carpale radiale', Radius: 'Radio', Scapula: 'Scapola',
  Ribs: 'Coste', Sternebrae: 'Sternebre', Xiphoid_Process: 'Processo xifoideo',
  Bladder: 'Vescica', Duodenom: 'Duodeno', Heart: 'Cuore', Kidneys: 'Reni',
  Large_Intestine: 'Intestino crasso', Liver: 'Fegato', Lungs: 'Polmoni',
  Small_Intestine: 'Intestino tenue', Spleen: 'Milza', Stomach: 'Stomaco',
  Renal_Artery: 'Arteria renale', Renal_Vein: 'Vena renale', Ureter: 'Uretere',
  Vena_Cava: 'Vena cava',
};

const SIDE = {
  Left_Back: 'posteriore sinistro', Right_Back: 'posteriore destro',
  Left_Front: 'anteriore sinistro', Right_Front: 'anteriore destro',
};

function classify(rel) {
  if (rel.startsWith('Organs/')) {
    const n = path.basename(rel);
    if (/Heart|Renal_Artery|Renal_Vein|Vena_Cava/i.test(n)) return 'circolatorio';
    if (/Lung/i.test(n)) return 'respiratorio';
    if (/Bladder|Kidney|Ureter/i.test(n)) return 'urinario';
    if (/Stomach|Intestine|Duoden|Liver|Spleen/i.test(n)) return 'digestivo';
    return 'organi';
  }
  return 'scheletrico';
}

function italianName(rel) {
  const parts = rel.split('/');
  const base = parts[parts.length - 1].replace(/\.glb$/i, '');
  const m = base.match(/^(.*?)(\d+)$/);
  const stem = m ? m[1].replace(/_$/,'') : base;
  const num = m ? m[2] : '';
  let name = IT[stem] || IT[base] || stem.replace(/_/g, ' ');
  if (num && /Caudal|Renal|Ureter/i.test(stem)) {
    name = `${name} ${num}`;
  } else if (num) {
    name = `${name} ${num}`;
  }
  const sideKey = parts.find((p) => SIDE[p]);
  if (sideKey) name = `${name} (${SIDE[sideKey]})`;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function latinName(rel) {
  return path.basename(rel).replace(/_/g, ' ');
}

function description(rel, sistema) {
  const n = italianName(rel);
  const sys = {
    scheletrico: 'Componente scheletrica canina',
    circolatorio: 'Struttura circolatoria canina',
    respiratorio: 'Struttura respiratoria canina',
    digestivo: 'Struttura digestiva canina',
    urinario: 'Struttura urinaria canina',
    organi: 'Organo canino',
  }[sistema] || 'Parte anatomica canina';
  return `${sys}: ${n}. Mesh reale Virginia Tech Virtual Animal Project.`;
}

/** Apply node world matrix to gather all mesh primitives into one Float32 positions + indices */
function extractMesh(doc) {
  const root = doc.getRoot();
  const positions = [];
  const indices = [];

  function mat4FromNode(node) {
    // Build world matrix walking parents
    const chain = [];
    let n = node;
    while (n) {
      chain.push(n);
      n = n.getParentNode?.() || null;
      // gltf-transform: getParents
      if (!n) {
        const parents = node.listParents?.() || [];
        // walk via scene graph differently
      }
    }
    return null;
  }

  // Use getBounds world extraction by reading POSITION and applying TRS from node chain
  const scenes = root.listScenes();
  const visitNodes = [];
  function collect(node, parentWorld) {
    const T = node.getTranslation();
    const R = node.getRotation(); // quat xyzw
    const S = node.getScale();
    const local = compose(T, R, S);
    const world = parentWorld ? mul(parentWorld, local) : local;
    const mesh = node.getMesh();
    if (mesh) {
      for (const prim of mesh.listPrimitives()) {
        const posAttr = prim.getAttribute('POSITION');
        if (!posAttr) continue;
        const arr = posAttr.getArray();
        const base = positions.length / 3;
        for (let i = 0; i < arr.length; i += 3) {
          const v = transform(world, arr[i], arr[i + 1], arr[i + 2]);
          positions.push(v[0] * SCALE, v[1] * SCALE, v[2] * SCALE);
        }
        const idx = prim.getIndices();
        if (idx) {
          const ia = idx.getArray();
          for (let i = 0; i < ia.length; i++) indices.push(base + ia[i]);
        } else {
          const vc = posAttr.getCount();
          for (let i = 0; i < vc; i++) indices.push(base + i);
        }
      }
    }
    for (const child of node.listChildren()) collect(child, world);
  }

  if (scenes.length) {
    for (const scene of scenes) {
      for (const child of scene.listChildren()) collect(child, null);
    }
  } else {
    for (const node of root.listNodes()) {
      if (!node.getParentNode || !node.listParents().some((p) => p.propertyType === 'Node')) {
        // root-ish
      }
    }
    // fallback: all meshes without transform
    for (const mesh of root.listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const posAttr = prim.getAttribute('POSITION');
        const arr = posAttr.getArray();
        const base = positions.length / 3;
        for (let i = 0; i < arr.length; i += 3) {
          positions.push(arr[i] * SCALE, arr[i + 1] * SCALE, arr[i + 2] * SCALE);
        }
        const idx = prim.getIndices();
        if (idx) {
          const ia = idx.getArray();
          for (let i = 0; i < ia.length; i++) indices.push(base + ia[i]);
        }
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  };
}

function compose(t, q, s) {
  // column-major 4x4
  const x = q[0], y = q[1], z = q[2], w = q[3];
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  const sx = s[0], sy = s[1], sz = s[2];
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    t[0], t[1], t[2], 1,
  ];
}

function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return o;
}

function transform(m, x, y, z) {
  const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
  ];
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

const io = new NodeIO();
fs.mkdirSync(OUT, { recursive: true });

const parts = [];
const binChunks = [];
let offset = 0;
const countsBySystem = {};

console.log('Packing canine from', SRC);
for (const rel of BONES) {
  const file = path.join(SRC, rel + '.glb');
  if (!fs.existsSync(file) || fs.statSync(file).size < 100) {
    console.warn('skip missing', rel);
    continue;
  }
  const doc = await io.read(file);
  const { positions, indices } = extractMesh(doc);
  if (positions.length < 9 || indices.length < 3) {
    console.warn('skip empty', rel);
    continue;
  }
  const { q, min, scale } = quantize(positions);
  const use16 = positions.length / 3 <= 65535;
  const idxBytes = use16
    ? (() => {
        const u16 = new Uint16Array(indices.length);
        for (let i = 0; i < indices.length; i++) u16[i] = indices[i];
        return Buffer.from(u16.buffer);
      })()
    : Buffer.from(indices.buffer.slice(indices.byteOffset, indices.byteOffset + indices.byteLength));

  const posBuf = Buffer.from(q.buffer.slice(q.byteOffset, q.byteOffset + q.byteLength));
  // align to 4
  const pad = (n) => (4 - (n % 4)) % 4;
  const posOffset = offset;
  binChunks.push(posBuf);
  offset += posBuf.length;
  const padv = pad(offset);
  if (padv) { binChunks.push(Buffer.alloc(padv)); offset += padv; }
  const idxOffset = offset;
  binChunks.push(idxBytes);
  offset += idxBytes.length;
  const padi = pad(offset);
  if (padi) { binChunks.push(Buffer.alloc(padi)); offset += padi; }

  const sistema = classify(rel);
  countsBySystem[sistema] = (countsBySystem[sistema] || 0) + 1;
  const id = 'CAN_' + rel.replace(/\//g, '_');
  const en = path.basename(rel).replace(/_/g, ' ');
  const nome = italianName(rel);
  parts.push({
    id,
    bp: rel,
    fma: '',
    nome,
    en,
    latino: latinName(rel),
    sistema,
    descrizione: description(rel, sistema),
    vertexCount: positions.length / 3,
    indexCount: indices.length,
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
  console.log('+', nome, sistema, positions.length / 3, 'verts');
}

const catalog = {
  source: 'Virginia Tech Virtual Animal Project (VT-ARIES/Anatomy)',
  sourceUrl: 'https://github.com/VT-ARIES/Anatomy',
  license: 'CC BY-NC-SA 4.0',
  attribution:
    'Canine anatomy meshes: Virginia Tech Virtual Animal Project (ARIES), licensed under CC BY-NC-SA 4.0',
  version: 'Production',
  species: 'cane',
  count: parts.length,
  countsBySystem,
  bin: 'meshes.bin',
  notes:
    'Mostly skeletal + selected organs. Skull.glb, Kidneys.glb, Small_Intestine.glb missing upstream (iCloud stubs only).',
  parts,
};

fs.writeFileSync(path.join(OUT, 'catalog.json'), JSON.stringify(catalog));
fs.writeFileSync(path.join(OUT, 'meshes.bin'), Buffer.concat(binChunks));
console.log('Wrote', parts.length, 'parts,', (offset / 1e6).toFixed(2), 'MB bin');
console.log('counts', countsBySystem);

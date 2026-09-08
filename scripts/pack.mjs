import fs from 'fs';
import { classifySystem } from "./classify.mjs";
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OBJ_DIR = path.resolve(ROOT, 'tmp/isa_obj/isa_BP3D_4.0_obj_99');
const OUT_DIR = path.resolve(ROOT, 'public/models/bp3d');
const LIMIT = Number(process.env.LIMIT || 0);

function parseHeader(text) {
  const get = (label) => {
    const re = new RegExp('#\\s*' + label + '[ \\t]*:[ \\t]*(.*)', 'i');
    const m = text.match(re);
    return m ? m[1].replace(/\r$/, '').trim() : '';
  };
  return {
    fileId: get('File ID'),
    bp: get('Representation ID'),
    fma: get('Concept ID'),
    en: get('English name'),
  };
}



// Minimal Italianization: capitalize + keep EN with common swaps
const SWAP = [
  [/Right\b/g, 'Destro'], [/Left\b/g, 'Sinistro'],
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
  [/rib\b/gi, 'costa'], [/tooth\b/gi, 'dente'], [/teeth\b/gi, 'denti'],
  [/Upper\b/g, 'Superiore'], [/Lower\b/g, 'Inferiore'],
  [/Anterior\b/g, 'Anteriore'], [/Posterior\b/g, 'Posteriore'],
  [/Superior\b/g, 'Superiore'], [/Inferior\b/g, 'Inferiore'],
  [/Medial\b/g, 'Mediale'], [/Lateral\b/g, 'Laterale'],
  [/Internal\b/g, 'Interno'], [/External\b/g, 'Esterno'],
  [/of\b/g, 'di'], [/and\b/g, 'e'], [/the\b/gi, ''],
];

function toItalian(en) {
  let s = en || 'Struttura anatomica';
  for (const [re, rep] of SWAP) s = s.replace(re, rep);
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function parseObj(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const header = raw.slice(0, 2000);
  const meta = parseHeader(header);
  const positions = [];
  const indices = [];
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith('v ')) {
      const p = line.split(/\s+/);
      const x = +p[1], y = +p[2], z = +p[3];
      positions.push(x * 0.001, z * 0.001, -y * 0.001);
    } else if (line.startsWith('f ')) {
      const face = line.split(/\s+/).slice(1).filter(Boolean).map((t) => parseInt(t.split('/')[0], 10) - 1);
      for (let i = 1; i < face.length - 1; i++) indices.push(face[0], face[i], face[i + 1]);
    }
  }
  return { meta, positions: new Float32Array(positions), indices: new Uint32Array(indices) };
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

console.log('Scanning', OBJ_DIR);
let files = fs.readdirSync(OBJ_DIR).filter((f) => f.endsWith('.obj')).sort();
if (LIMIT > 0) files = files.slice(0, LIMIT);
console.log('Files', files.length);
fs.mkdirSync(OUT_DIR, { recursive: true });

const parts = [];
const chunks = [];
let offset = 0;
let n = 0;

for (const file of files) {
  const id = file.replace(/\.obj$/i, '');
  let { meta, positions, indices } = parseObj(path.join(OBJ_DIR, file));
  if (!meta.en) {
    const mFile = id.endsWith('M') ? null : id + 'M.obj';
    if (mFile && fs.existsSync(path.join(OBJ_DIR, mFile))) {
      const mh = parseHeader(fs.readFileSync(path.join(OBJ_DIR, mFile), 'utf8').slice(0, 1500));
      meta.en = mh.en ? 'Left ' + mh.en.replace(/^Left\s+/i, '') : 'Structure ' + id;
      meta.bp = meta.bp || mh.bp;
      meta.fma = meta.fma || mh.fma;
    } else {
      meta.en = 'Anatomical structure ' + id;
    }
  }
  if (positions.length < 9 || indices.length < 3) {
    console.warn('skip', id);
    continue;
  }
  const sistema = classifySystem(meta.en);
  const nome = toItalian(meta.en);
  const vertexCount = positions.length / 3;
  const indexCount = indices.length;
  const { q, min, scale } = quantize(positions);
  const use16 = vertexCount <= 65535;
  const indexBuf = use16 ? Uint16Array.from(indices) : indices;
  const posEncoded = Buffer.from(q.buffer, q.byteOffset, q.byteLength);
  const idxEncoded = Buffer.from(indexBuf.buffer, indexBuf.byteOffset, indexBuf.byteLength);

  const posOffset = offset;
  chunks.push(posEncoded);
  offset += posEncoded.length;
  const pad1 = (4 - (offset % 4)) % 4;
  if (pad1) { chunks.push(Buffer.alloc(pad1)); offset += pad1; }
  const idxOffset = offset;
  chunks.push(idxEncoded);
  offset += idxEncoded.length;
  const pad2 = (4 - (offset % 4)) % 4;
  if (pad2) { chunks.push(Buffer.alloc(pad2)); offset += pad2; }

  parts.push({
    id, bp: meta.bp || '', fma: meta.fma || '',
    nome, en: meta.en, latino: meta.en, sistema,
    descrizione: 'Mesh anatomica BodyParts3D: ' + meta.en,
    vertexCount, indexCount,
    posOffset, posBytes: posEncoded.length,
    idxOffset, idxBytes: idxEncoded.length,
    posEncoding: 'quant16',
    idxEncoding: use16 ? 'u16' : 'u32',
    indexSize: use16 ? 2 : 4,
    quantMin: min, quantScale: scale,
  });
  n++;
  if (n % 50 === 0) console.log(n + '/' + files.length);
}

const binPath = path.join(OUT_DIR, 'meshes.bin');
fs.writeFileSync(binPath, Buffer.concat(chunks));
const counts = {};
for (const p of parts) counts[p.sistema] = (counts[p.sistema] || 0) + 1;
const catalog = {
  source: 'BodyParts3D',
  sourceUrl: 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/desc.html',
  license: 'CC BY-SA 2.1 JP',
  attribution: 'BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan',
  version: '4.0',
  buildLogic: 'FMA 3.0 is_a (99% reduced OBJ)',
  count: parts.length,
  countsBySystem: counts,
  bin: 'meshes.bin',
  parts,
};
fs.writeFileSync(path.join(OUT_DIR, 'catalog.json'), JSON.stringify(catalog));
fs.writeFileSync(path.join(ROOT, 'src/data/catalog-meta.json'), JSON.stringify({
  count: parts.length, countsBySystem: counts,
  attribution: catalog.attribution, license: catalog.license, source: catalog.source,
}, null, 2));
console.log('DONE', parts.length, 'binMB', (fs.statSync(binPath).size / 1e6).toFixed(1), counts);

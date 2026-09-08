import { NodeIO } from '@gltf-transform/core';
import fs from 'fs';
import path from 'path';

const SCALE = 0.032;
const rootDir = 'tmp/vt-anatomy/models/Canine';
const io = new NodeIO();
let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
let count = 0;
async function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) await walk(p);
    else if (ent.name.endsWith('.glb')) {
      const doc = await io.read(p);
      for (const mesh of doc.getRoot().listMeshes()) {
        for (const prim of mesh.listPrimitives()) {
          const arr = prim.getAttribute('POSITION').getArray();
          for (let i = 0; i < arr.length; i += 3) {
            for (let c = 0; c < 3; c++) {
              const v = arr[i + c] * SCALE;
              if (v < min[c]) min[c] = v;
              if (v > max[c]) max[c] = v;
            }
          }
          count++;
        }
      }
    }
  }
}
await walk(rootDir);
console.log('parts', count);
console.log('min', min);
console.log('max', max);
console.log('size', max.map((v, i) => v - min[i]));

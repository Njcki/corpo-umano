import { NodeIO } from '@gltf-transform/core';
import { getBounds } from '@gltf-transform/functions';
import fs from 'fs';
import path from 'path';

const io = new NodeIO();
const rootDir = 'tmp/vt-anatomy/models/Canine';
function listGlbs(dir, out=[]) {
  for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
    const p=path.join(dir,e.name);
    if (e.isDirectory()) listGlbs(p,out);
    else if (e.name.endsWith('.glb')) out.push(p);
  }
  return out;
}
const files=listGlbs(rootDir);
let gMin=[Infinity,Infinity,Infinity], gMax=[-Infinity,-Infinity,-Infinity];
for (const f of files) {
  const doc = await io.read(f);
  const scene = doc.getRoot().listScenes()[0];
  if (!scene) continue;
  const b = getBounds(scene);
  for (let c=0;c<3;c++){ if(b.min[c]<gMin[c])gMin[c]=b.min[c]; if(b.max[c]>gMax[c])gMax[c]=b.max[c]; }
}
console.log('world min', gMin);
console.log('world max', gMax);
console.log('world size', gMax.map((v,i)=>v-gMin[i]));
console.log('files', files.length);

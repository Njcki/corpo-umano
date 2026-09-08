import { NodeIO } from '@gltf-transform/core';

const io = new NodeIO();
const doc = await io.read('tmp/vt-anatomy/models/Canine/Legs/Left_Back/Femur.glb');
const root = doc.getRoot();
console.log('meshes', root.listMeshes().length);
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    const idx = prim.getIndices();
    console.log('prim verts', pos.getCount(), 'idx', idx?.getCount(), 'mode', prim.getMode());
    const arr = pos.getArray();
    let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < arr.length; i += 3) {
      for (let c = 0; c < 3; c++) {
        const v = arr[i + c];
        if (v < min[c]) min[c] = v;
        if (v > max[c]) max[c] = v;
      }
    }
    console.log('bounds', min, max, 'size', max.map((v, i) => v - min[i]));
  }
}

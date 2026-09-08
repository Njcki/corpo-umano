import { NodeIO } from '@gltf-transform/core';
import { getBounds } from '@gltf-transform/functions';

const io = new NodeIO();
for (const f of [
  'tmp/vt-anatomy/models/Canine/Legs/Left_Back/Femur.glb',
  'tmp/vt-anatomy/models/Canine/Organs/Heart.glb',
  'tmp/vt-anatomy/models/Canine/Skull/Mandible.glb',
  'tmp/vt-anatomy/models/Canine/Ribs/Ribs.glb',
]) {
  const doc = await io.read(f);
  // scene node transforms
  for (const node of doc.getRoot().listNodes()) {
    const t = node.getTranslation();
    const s = node.getScale();
    const r = node.getRotation();
    console.log(f.split('/').slice(-2).join('/'), 'node', node.getName(), 'T', t, 'S', s, 'R', r);
  }
  try {
    const b = getBounds(doc.getRoot().listScenes()[0] || doc.getRoot().listNodes()[0]);
    console.log('  getBounds', b);
  } catch (e) {
    console.log('  getBounds err', e.message);
  }
}

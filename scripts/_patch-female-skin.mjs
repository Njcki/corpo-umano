import fs from 'fs';

let text = fs.readFileSync('scripts/pack-female.mjs', 'utf8');

// Insert male-skin / male-genitalia exclusion into shouldExclude
const marker = `  if (id === 'VH_F_skin') return 'hra-skin';`;
if (!text.includes(marker)) throw new Error('VH_F_skin marker missing');

const insert = `  if (id === 'VH_F_skin') return 'hra-skin';

  // CRITICAL: BP3D "Skin" (FJ2810) is a male body surface (external genitalia visible).
  // Never ship it in Donna — better no full-body skin than wrong-sex cute.
  if (id === 'BP3D_FJ2810' || id === 'FJ2810') return 'male-bp3d-skin';
  if ((id.startsWith('BP3D') || id.startsWith('FJ')) && /^(skin|cute)$/i.test((p.name || '').trim())) {
    return 'male-bp3d-skin';
  }
  // Explicit male reproductive / external genitalia (if any slip through Female Atlas)
  if (/prostate|testis|penis|scrotum|epididymis|spermatic|seminal vesicle|ductus deferens|foreskin|glans|corpus cavernosum|corpus spongiosum|scrotal|prepuce|ejaculat|bulbourethral/i.test((p.name || '') + ' ' + id)) {
    return 'male-genitalia';
  }
`;

if (text.includes('male-bp3d-skin')) {
  console.log('already patched exclusions');
} else {
  text = text.replace(marker, insert);
}

// Update notes
text = text.replace(
  /notes:\n    'Donna:[^']*',/,
  "notes:\n    'Donna: cute BP3D maschile (FJ2810) esclusa — genitalia maschili sul mesh. Solo HRA riproduttivo femminile + BP3D scheletro/muscoli/occhi. Eyebrow/hair/lip ok.',"
);

fs.writeFileSync('scripts/pack-female.mjs', text);
console.log('pack-female skin exclusion ok');

import fs from 'fs';
const path = 'src/scene/BodyBuilder.ts';
let t = fs.readFileSync(path, 'utf8');
if (t.includes('male-bp3d-skin') || t.includes('SKIP_MALE_SKIN')) {
  console.log('BodyBuilder already guarded');
  process.exit(0);
}
const needle = `      const rec = records[i];
      const part: AnatomyPart = {`;
const guard = `      const rec = records[i];
      // Donna: never load male BP3D full-body skin (external genitalia)
      if (
        (catalog.sex === 'female' || catalog.species === 'donna') &&
        (rec.id === 'BP3D_FJ2810' || rec.id === 'FJ2810' ||
          (rec.sistema === 'tegumentario' && /^(skin|cute)$/i.test(rec.en || rec.nome || '')))
      ) {
        continue;
      }
      if (
        (catalog.sex === 'female' || catalog.species === 'donna') &&
        /prostate|testis|penis|scrotum|epididymis|spermatic|seminal|deferens|foreskin|glans penis|cavernosum|spongiosum/i.test(
          \`\${rec.en || ''} \${rec.nome || ''} \${rec.id}\`,
        )
      ) {
        continue;
      }
      const part: AnatomyPart = {`;
if (!t.includes(needle)) throw new Error('BodyBuilder needle missing');
t = t.replace(needle, guard);
fs.writeFileSync(path, t);
console.log('BodyBuilder runtime guard ok');

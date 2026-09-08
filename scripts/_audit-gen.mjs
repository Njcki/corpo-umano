import fs from 'fs';
const a = JSON.parse(fs.readFileSync('tmp/female-atlas/public/models/atlas.json', 'utf8'));
const f = JSON.parse(fs.readFileSync('public/models/female/catalog.json', 'utf8'));
const re = /penis|scrotum|prostate|testis|testicle|epididymis|spermatic|seminal|deferens|glans|foreskin|scrotal|prepuce|corpus cavernosum|spongiosum|male urethra|prostatic|ejaculat|bulbourethral|cowper/i;
console.log('atlas hits', a.parts.filter(p => re.test(p.name+' '+p.id)).map(p => p.id+' '+p.system+' '+p.name));
console.log('female hits', f.parts.filter(p => re.test((p.en||'')+' '+p.nome+' '+p.id)).map(p => p.id+' '+p.sistema+' '+p.nome));
// genital-ish Y region of skin - check if we can find separate perineum
console.log('perineum/pubic', a.parts.filter(p => /perineum|pubic|vulva|labia|clitoris|vagina|mons/i.test(p.name)).map(p => p.id+' '+p.system+' '+p.name));
// Is there original HRA skin in female source dirs?
import {execSync} from 'child_process';
try {
  console.log(execSync("find tmp/female-atlas -iname '*skin*' 2>/dev/null | head -20").toString());
} catch {}

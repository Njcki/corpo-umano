import fs from 'fs';
const a = JSON.parse(fs.readFileSync('tmp/female-atlas/public/models/atlas.json', 'utf8'));
const integ = a.parts.filter(p => p.system === 'integumentary' || /skin|penis|scrotum|genital|perineum|pubic/i.test(p.name + ' ' + p.id));
console.log('=== integumentary / skin-ish in atlas ===');
integ.forEach(p => console.log(p.id, p.system, p.name));
const male = a.parts.filter(p => /penis|scrotum|prostate|testis|epididymis|spermatic|seminal|ductus deferens|glans|foreskin|scrotal|male/i.test(p.name + ' ' + p.id));
console.log('=== male-named in atlas ===');
male.forEach(p => console.log(p.id, p.system, p.name));
const f = JSON.parse(fs.readFileSync('public/models/female/catalog.json', 'utf8'));
console.log('=== packed tegumentario ===');
console.log(f.parts.filter(p => p.sistema === 'tegumentario').map(p => p.id + ' | ' + p.nome + ' | ' + p.en));
console.log('=== packed male gen ===');
console.log(f.parts.filter(p => /penis|scrotum|prostate|testis|epididymis|spermatic|seminal|deferens|glans|foreskin|scrotal/i.test((p.en||'')+' '+p.nome+' '+p.id)).map(p => p.id+' '+p.sistema+' '+p.nome));
// Check if VH_F_skin exists in source atlas
console.log('VH_F_skin in atlas?', a.parts.some(p => p.id === 'VH_F_skin'));

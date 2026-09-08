import fs from 'fs';
const m = JSON.parse(fs.readFileSync('public/models/bp3d/catalog.json', 'utf8'));
const re = /penis|scrotum|prostate|testis|testicle|epididymis|spermatic|seminal|deferens|glans|foreskin|scrotal|prepuce|cavernosum|spongiosum|prostatic|ejaculat/i;
const hits = m.parts.filter(p => re.test((p.en||'')+' '+p.nome+' '+p.id));
console.log('male catalog genitalia', hits.length);
hits.forEach(p => console.log(p.id, p.sistema, p.nome, p.en));

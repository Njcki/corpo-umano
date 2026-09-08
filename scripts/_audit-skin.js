const fs=require('fs');
const a=JSON.parse(fs.readFileSync('tmp/female-atlas/public/models/atlas.json','utf8'));
const integ=a.parts.filter(p=>p.system==='integumentary'||/skin|penis|scrotum|genital|perineum|pubic/i.test(p.name+' '+p.id));
integ.forEach(p=>console.log(p.id,p.system,p.name));
const repro=a.parts.filter(p=>p.system==='reproductive'||/penis|scrotum|prostate|testis|epididymis|spermatic|seminal|ductus deferens|glans|foreskin/i.test(p.name+' '+p.id));
console.log('---repro/male---');
repro.forEach(p=>console.log(p.id,p.system,p.name));

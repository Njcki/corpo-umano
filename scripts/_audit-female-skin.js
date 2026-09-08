const fs=require('fs');
const f=JSON.parse(fs.readFileSync('public/models/female/catalog.json','utf8'));
console.log('tegumentario',f.parts.filter(p=>p.sistema==='tegumentario').map(p=>p.id+' '+p.nome+' '+p.en));
console.log('male gen',f.parts.filter(p=>/penis|scrotum|prostate|testis|epididymis|spermatic|seminal|deferens|glans|foreskin|scrotal/i.test((p.en||'')+' '+p.nome+' '+p.id)).map(p=>p.id+' '+p.sistema+' '+p.nome));

import fs from "fs";
const raw=fs.readFileSync("/workspace/corpo-umano/tmp/isa_obj/isa_BP3D_4.0_obj_99/FJ3130.obj","utf8");
console.log("bytes", raw.length);
console.log("verts", raw.split("\n").filter(l=>l.startsWith("v ")).length);

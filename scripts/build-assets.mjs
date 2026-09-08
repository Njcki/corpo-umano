/**
 * Build BodyParts3D assets for Corpo Umano.
 * Reads IS-A 99% OBJ meshes, packs quantized binary + Italian catalog.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OBJ_DIR = path.resolve(ROOT, 'tmp/isa_obj/isa_BP3D_4.0_obj_99');
const OUT_DIR = path.resolve(ROOT, 'public/models/bp3d');
const PARTS_LIST = path.resolve(ROOT, 'tmp/isa_parts_list_e.txt');

const TERM_IT = {
  // articles / connectors handled separately
  left: 'sinistro',
  right: 'destro',
  upper: 'superiore',
  lower: 'inferiore',
  anterior: 'anteriore',
  posterior: 'posteriore',
  superior: 'superiore',
  inferior: 'inferiore',
  medial: 'mediale',
  lateral: 'laterale',
  proximal: 'prossimale',
  distal: 'distale',
  deep: 'profondo',
  superficial: 'superficiale',
  internal: 'interno',
  external: 'esterno',
  greater: 'grande',
  lesser: 'piccolo',
  major: 'maggiore',
  minor: 'minore',
  common: 'comune',
  proper: 'proprio',
  accessory: 'accessorio',
  middle: 'medio',
  central: 'centrale',
  dorsal: 'dorsale',
  ventral: 'ventrale',
  cranial: 'craniale',
  caudal: 'caudale',
  cervical: 'cervicale',
  thoracic: 'toracico',
  lumbar: 'lombare',
  sacral: 'sacrale',
  coccygeal: 'coccigeo',
  bone: 'osso',
  bones: 'ossa',
  muscle: 'muscolo',
  muscles: 'muscoli',
  tendon: 'tendine',
  ligament: 'legamento',
  cartilage: 'cartilagine',
  joint: 'articolazione',
  artery: 'arteria',
  arteries: 'arterie',
  vein: 'vena',
  veins: 'vene',
  nerve: 'nervo',
  nerves: 'nervi',
  gland: 'ghiandola',
  node: 'linfonodo',
  vessel: 'vaso',
  vessels: 'vasi',
  branch: 'ramo',
  branches: 'rami',
  trunk: 'tronco',
  body: 'corpo',
  head: 'testa',
  neck: 'collo',
  shaft: 'diafisi',
  process: 'processo',
  facet: 'faccetta',
  foramen: 'foro',
  canal: 'canale',
  sinus: 'seno',
  cavity: 'cavità',
  wall: 'parete',
  lobe: 'lobo',
  segment: 'segmento',
  part: 'parte',
  set: 'insieme',
  of: 'di',
  and: 'e',
  the: '',
  a: '',
  an: '',
  to: 'a',
  in: 'in',
  for: 'per',
  with: 'con',
  from: 'da',
  // organs / structures
  skin: 'cute',
  heart: 'cuore',
  lung: 'polmone',
  lungs: 'polmoni',
  liver: 'fegato',
  spleen: 'milza',
  stomach: 'stomaco',
  pancreas: 'pancreas',
  kidney: 'rene',
  kidneys: 'reni',
  bladder: 'vescica',
  brain: 'cervello',
  cerebellum: 'cervelletto',
  cerebrum: 'cerebro',
  thalamus: 'talamo',
  hypothalamus: 'ipotalamo',
  brainstem: 'tronco encefalico',
  'spinal cord': 'midollo spinale',
  trachea: 'trachea',
  bronchus: 'bronco',
  bronchi: 'bronchi',
  esophagus: 'esofago',
  oesophagus: 'esofago',
  intestine: 'intestino',
  colon: 'colon',
  rectum: 'retto',
  anus: 'ano',
  duodenum: 'duodeno',
  jejunum: 'digiuno',
  ileum: 'ileo',
  cecum: 'cieco',
  appendix: 'appendice',
  gallbladder: 'cistifellea',
  'gall bladder': 'cistifellea',
  thyroid: 'tiroide',
  parathyroid: 'paratiroide',
  adrenal: 'surrenale',
  pituitary: 'ipofisi',
  thymus: 'timo',
  prostate: 'prostata',
  testis: 'testicolo',
  testes: 'testicoli',
  ovary: 'ovaio',
  uterus: 'utero',
  vagina: 'vagina',
  penis: 'pene',
  urethra: 'uretra',
  ureter: 'uretere',
  aorta: 'aorta',
  'vena cava': 'vena cava',
  atrium: 'atrio',
  ventricle: 'ventricolo',
  valve: 'valvola',
  diaphragm: 'diaframma',
  rib: 'costa',
  ribs: 'coste',
  sternum: 'sterno',
  clavicle: 'clavicola',
  scapula: 'scapola',
  humerus: 'omero',
  radius: 'radio',
  ulna: 'ulna',
  femur: 'femore',
  tibia: 'tibia',
  fibula: 'fibula',
  patella: 'rotula',
  pelvis: 'bacino',
  ilium: 'ilio',
  ischium: 'ischio',
  pubis: 'pube',
  sacrum: 'sacro',
  coccyx: 'coccige',
  vertebra: 'vertebra',
  vertebrae: 'vertebre',
  skull: 'cranio',
  mandible: 'mandibola',
  maxilla: 'mascella',
  frontal: 'frontale',
  parietal: 'parietale',
  temporal: 'temporale',
  occipital: 'occipitale',
  sphenoid: 'sfenoide',
  ethmoid: 'etmoide',
  zygomatic: 'zigomatico',
  nasal: 'nasale',
  tooth: 'dente',
  teeth: 'denti',
  molar: 'molare',
  premolar: 'premolare',
  canine: 'canino',
  incisor: 'incisivo',
  gingiva: 'gengiva',
  tongue: 'lingua',
  lip: 'labbro',
  eye: 'occhio',
  ear: 'orecchio',
  nose: 'naso',
  mouth: 'bocca',
  pharynx: 'faringe',
  larynx: 'laringe',
  cornea: 'cornea',
  retina: 'retina',
  iris: 'iride',
  lens: 'cristallino',
  'optic nerve': 'nervo ottico',
  'facial nerve': 'nervo faciale',
  'vagus nerve': 'nervo vago',
  lymph: 'linfa',
  lymphatic: 'linfatico',
  fascia: 'fascia',
  bursa: 'borsa',
  meniscus: 'menisco',
  disc: 'disco',
  disk: 'disco',
  intervertebral: 'intervertebrale',
  costal: 'costale',
  intercostal: 'intercostale',
  abdominal: 'addominale',
  pelvic: 'pelvico',
  femoral: 'femorale',
  brachial: 'brachiale',
  radial: 'radiale',
  ulnar: 'ulnare',
  tibial: 'tibiale',
  fibular: 'peroneale',
  popliteal: 'popliteo',
  axillary: 'ascellare',
  subclavian: 'succlavia',
  carotid: 'carotide',
  jugular: 'giugulare',
  coronary: 'coronarica',
  pulmonary: 'polmonare',
  hepatic: 'epatica',
  renal: 'renale',
  mesenteric: 'mesenterica',
  iliac: 'iliaca',
  sacral: 'sacrale',
  sciatic: 'sciatico',
  median: 'mediano',
  ulnar: 'ulnare',
  radial: 'radiale',
  musculocutaneous: 'muscolocutaneo',
  phrenic: 'frenico',
  sympathetic: 'simpatico',
  parasympathetic: 'parasimpatico',
  ganglion: 'ganglio',
  plexus: 'plesso',
  cortex: 'corteccia',
  medulla: 'midollo',
  capsule: 'capsula',
  cortex: 'corteccia',
  hilum: 'ilo',
  cortex: 'corteccia',
  white: 'bianca',
  matter: 'sostanza',
  gray: 'grigia',
  grey: 'grigia',
  ascending: 'ascendente',
  descending: 'discendente',
  transverse: 'trasverso',
  oblique: 'obliquo',
  rectus: 'retto',
  longus: 'lungo',
  brevis: 'breve',
  maximus: 'massimo',
  medius: 'medio',
  minimus: 'minimo',
  longissimus: 'lunghissimo',
  latissimus: 'larghissimo',
  serratus: 'dentato',
  trapezius: 'trapezio',
  deltoid: 'deltoide',
  biceps: 'bicipite',
  triceps: 'tricipite',
  quadriceps: 'quadricipite',
  gastrocnemius: 'gastrocnemio',
  soleus: 'soleo',
  gluteus: 'gluteo',
  psoas: 'psoas',
  iliacus: 'iliaco',
  pectoralis: 'pettorale',
  sternocleidomastoid: 'sternocleidomastoideo',
  masseter: 'massetere',
  temporalis: 'temporale',
  orbicularis: 'orbicolare',
  buccinator: 'buccinatore',
  digastric: 'digastrico',
  mylohyoid: 'miloioideo',
  geniohyoid: 'genioioideo',
  stylohyoid: 'stiloioideo',
  omohyoid: 'omoioideo',
  sternohyoid: 'sternoioideo',
  sternothyroid: 'sternotiroideo',
  thyrohyoid: 'tiroioideo',
  scalene: 'scaleno',
  splenius: 'splenio',
  semispinalis: 'semispinale',
  multifidus: 'multifido',
  rotatores: 'rotatori',
  interspinales: 'interspinali',
  intertransversarii: 'intertrasversari',
  levator: 'elevatore',
  depressor: 'depressore',
  constrictor: 'costrittore',
  sphincter: 'sfintere',
  dilator: 'dilatatore',
  flexor: 'flessore',
  extensor: 'estensore',
  abductor: 'abduzione',
  adductor: 'adduttore',
  rotator: 'rotatore',
  pronator: 'pronatore',
  supinator: 'supinatore',
  teres: 'rotondo',
  rhomboid: 'romboidale',
  infraspinatus: 'infraspinato',
  supraspinatus: 'sovraspinato',
  subscapularis: 'sottoscapolare',
  coracobrachialis: 'coracobrachiale',
  brachialis: 'brachiale',
  brachioradialis: 'brachioradiale',
  anconeus: 'anconeo',
  palmaris: 'palmare',
  plantaris: 'plantare',
  popliteus: 'popliteo',
  tibialis: 'tibiale',
  peroneus: 'peroneo',
  fibularis: 'peroneo',
  hallux: 'alluce',
  pollicis: 'del pollice',
  indicis: 'dell\'indice',
  digitorum: 'delle dita',
  digiti: 'del dito',
  manus: 'della mano',
  pedis: 'del piede',
  hand: 'mano',
  foot: 'piede',
  thumb: 'pollice',
  finger: 'dito',
  toe: 'dito del piede',
  wrist: 'polso',
  ankle: 'caviglia',
  elbow: 'gomito',
  knee: 'ginocchio',
  hip: 'anca',
  shoulder: 'spalla',
  chest: 'torace',
  abdomen: 'addome',
  back: 'dorso',
  face: 'viso',
  scalp: 'cuoio capelluto',
  eyelid: 'palpebra',
  eyebrow: 'sopracciglio',
  cheek: 'guancia',
  chin: 'mento',
  forehead: 'fronte',
  temple: 'tempia',
  jaw: 'mascella',
  secondary: 'permanente',
  primary: 'deciduo',
  deciduous: 'deciduo',
  permanent: 'permanente',
  first: 'primo',
  second: 'secondo',
  third: 'terzo',
  fourth: 'quarto',
  fifth: 'quinto',
  sixth: 'sesto',
  seventh: 'settimo',
  eighth: 'ottavo',
  ninth: 'nono',
  tenth: 'decimo',
  eleventh: 'undicesimo',
  twelfth: 'dodicesimo',
  pair: 'coppia',
  portion: 'porzione',
  region: 'regione',
  surface: 'superficie',
  border: 'margine',
  margin: 'margine',
  apex: 'apice',
  base: 'base',
  root: 'radice',
  crown: 'corona',
  pulp: 'polpa',
  enamel: 'smalto',
  dentin: 'dentina',
  cementum: 'cemento',
  alveolus: 'alveolo',
  periodontal: 'parodontale',
  salivary: 'salivare',
  parotid: 'parotide',
  submandibular: 'sottomandibolare',
  sublingual: 'sottolinguale',
  tonsil: 'tonsilla',
  adenoid: 'adenoide',
  mucosa: 'mucosa',
  serosa: 'sierosa',
  adventitia: 'avventizia',
  epithelium: 'epitelio',
  endothelium: 'endotelio',
  mesothelium: 'mesotelio',
  connective: 'connettivo',
  adipose: 'adiposo',
  tissue: 'tessuto',
  membrane: 'membrana',
  sheath: 'guaina',
  septum: 'setto',
  sulcus: 'solco',
  gyrus: 'giro',
  fissure: 'scissura',
  fissura: 'scissura',
  fossa: 'fossa',
  tubercle: 'tubercolo',
  tuberosity: 'tuberosità',
  crest: 'cresta',
  spine: 'spina',
  angle: 'angolo',
  notch: 'incisura',
  groove: 'solco',
  ridge: 'cresta',
  line: 'linea',
  arch: 'arco',
  ring: 'anello',
  plate: 'lamina',
  lamina: 'lamina',
  layer: 'strato',
  stratum: 'strato',
  bundle: 'fascio',
  fascicle: 'fascicolo',
  fiber: 'fibra',
  fibre: 'fibra',
  cord: 'funicolo',
  band: 'banda',
  raphe: 'rafe',
  commissure: 'commissura',
  chiasm: 'chiasma',
  tract: 'tratto',
  pathway: 'via',
  circuit: 'circuito',
  network: 'rete',
  anastomosis: 'anastomosi',
  collateral: 'collaterale',
  communicating: 'comunicante',
  perforating: 'perforante',
  circumflex: 'circonflessa',
  recurrent: 'ricorrente',
  nutrient: 'nutrizia',
  bronchial: 'bronchiale',
  esophageal: 'esofagea',
  gastric: 'gastrica',
  splenic: 'splenica',
  pancreatic: 'pancreatica',
  duodenal: 'duodenale',
  colic: 'colica',
  rectal: 'rettale',
  vesical: 'vescicale',
  prostatic: 'prostatica',
  testicular: 'testicolare',
  ovarian: 'ovarica',
  uterine: 'uterina',
  vaginal: 'vaginale',
  pudendal: 'pudendo',
  gluteal: 'glutea',
  obturator: 'otturatoria',
  genitofemoral: 'genitofemorale',
  ilioinguinal: 'ilioinguinale',
  iliohypogastric: 'ilioipogastrico',
  subcostal: 'sottocostale',
  intercostal: 'intercostale',
  'spinal nerve': 'nervo spinale',
  'cranial nerve': 'nervo cranico',
  olfactory: 'olfattivo',
  optic: 'ottico',
  oculomotor: 'oculomotore',
  trochlear: 'trocleare',
  trigeminal: 'trigemino',
  abducens: 'abducente',
  facial: 'faciale',
  vestibulocochlear: 'vestibolococleare',
  glossopharyngeal: 'glossofaringeo',
  vagus: 'vago',
  accessory: 'accessorio',
  hypoglossal: 'ipoglosso',
  meninges: 'meningi',
  dura: 'dura madre',
  arachnoid: 'aracnoide',
  pia: 'pia madre',
  'cerebrospinal fluid': 'liquido cerebrospinale',
  ventricle: 'ventricolo',
  cistern: 'cisterna',
  choroid: 'coroide',
  pineal: 'pineale',
  'corpus callosum': 'corpo calloso',
  hippocampus: 'ippocampo',
  amygdala: 'amigdala',
  basal: 'basale',
  ganglia: 'gangli',
  striatum: 'striato',
  putamen: 'putamen',
  caudate: 'caudato',
  pallidum: 'pallido',
  substantia: 'sostanza',
  nigra: 'nera',
  red: 'rosso',
  nucleus: 'nucleo',
  olive: 'oliva',
  pons: 'ponte',
  midbrain: 'mesencefalo',
  'medulla oblongata': 'bulbo',
  'spinal ganglion': 'ganglio spinale',
  ramus: 'ramo',
  rami: 'rami',
  communicans: 'comunicante',
  ventralis: 'ventrale',
  dorsalis: 'dorsale',
  lateralis: 'laterale',
  medialis: 'mediale',
  anterioris: 'anteriore',
  posterioris: 'posteriore',
  superioris: 'superiore',
  inferioris: 'inferiore',
  dexter: 'destro',
  sinister: 'sinistro',
  dextra: 'destra',
  sinistra: 'sinistra',
  proprius: 'proprio',
  communis: 'comune',
  longus: 'lungo',
  brevis: 'breve',
};

// Multi-word phrases (longest first)
const PHRASES = [
  ['spinal cord', 'midollo spinale'],
  ['optic nerve', 'nervo ottico'],
  ['facial nerve', 'nervo faciale'],
  ['vagus nerve', 'nervo vago'],
  ['cranial nerve', 'nervo cranico'],
  ['spinal nerve', 'nervo spinale'],
  ['vena cava', 'vena cava'],
  ['gall bladder', 'cistifellea'],
  ['corpus callosum', 'corpo calloso'],
  ['medulla oblongata', 'bulbo'],
  ['cerebrospinal fluid', 'liquido cerebrospinale'],
  ['adrenal gland', 'ghiandola surrenale'],
  ['thyroid gland', 'ghiandola tiroide'],
  ['pituitary gland', 'ipofisi'],
  ['lymph node', 'linfonodo'],
  ['lymph nodes', 'linfonodi'],
  ['blood vessel', 'vaso sanguigno'],
  ['intervertebral disc', 'disco intervertebrale'],
  ['intervertebral disk', 'disco intervertebrale'],
  ['vertebral column', 'colonna vertebrale'],
  ['rib cage', 'gabbia toracica'],
  ['pectoral girdle', 'cintura scapolare'],
  ['pelvic girdle', 'cintura pelvica'],
  ['upper limb', 'arto superiore'],
  ['lower limb', 'arto inferiore'],
  ['upper jaw', 'mascella superiore'],
  ['lower jaw', 'mandibola'],
  ['temporal bone', 'osso temporale'],
  ['frontal bone', 'osso frontale'],
  ['parietal bone', 'osso parietale'],
  ['occipital bone', 'osso occipitale'],
  ['sphenoid bone', 'osso sfenoide'],
  ['ethmoid bone', 'osso etmoide'],
  ['zygomatic bone', 'osso zigomatico'],
  ['nasal bone', 'osso nasale'],
  ['hyoid bone', 'osso ioide'],
  ['pubic bone', 'osso pubico'],
  ['hip bone', 'osso dell\'anca'],
  ['femoral artery', 'arteria femorale'],
  ['femoral vein', 'vena femorale'],
  ['femoral nerve', 'nervo femorale'],
  ['sciatic nerve', 'nervo sciatico'],
  ['median nerve', 'nervo mediano'],
  ['radial nerve', 'nervo radiale'],
  ['ulnar nerve', 'nervo ulnare'],
  ['brachial plexus', 'plesso brachiale'],
  ['lumbar plexus', 'plesso lombare'],
  ['sacral plexus', 'plesso sacrale'],
  ['cervical plexus', 'plesso cervicale'],
  ['coronary artery', 'arteria coronaria'],
  ['pulmonary artery', 'arteria polmonare'],
  ['pulmonary vein', 'vena polmonare'],
  ['carotid artery', 'arteria carotide'],
  ['jugular vein', 'vena giugulare'],
  ['subclavian artery', 'arteria succlavia'],
  ['subclavian vein', 'vena succlavia'],
  ['axillary artery', 'arteria ascellare'],
  ['axillary vein', 'vena ascellare'],
  ['aortic arch', 'arco aortico'],
  ['ascending aorta', 'aorta ascendente'],
  ['descending aorta', 'aorta discendente'],
  ['abdominal aorta', 'aorta addominale'],
  ['thoracic aorta', 'aorta toracica'],
  ['right atrium', 'atrio destro'],
  ['left atrium', 'atrio sinistro'],
  ['right ventricle', 'ventricolo destro'],
  ['left ventricle', 'ventricolo sinistro'],
  ['mitral valve', 'valvola mitrale'],
  ['tricuspid valve', 'valvola tricuspide'],
  ['aortic valve', 'valvola aortica'],
  ['pulmonary valve', 'valvola polmonare'],
  ['small intestine', 'intestino tenue'],
  ['large intestine', 'intestino crasso'],
  ['urinary bladder', 'vescica urinaria'],
  ['gallbladder', 'cistifellea'],
  ['adrenal cortex', 'corteccia surrenale'],
  ['adrenal medulla', 'midollare surrenale'],
  ['gray matter', 'sostanza grigia'],
  ['grey matter', 'sostanza grigia'],
  ['white matter', 'sostanza bianca'],
  ['external anal sphincter', 'sfintere anale esterno'],
  ['internal anal sphincter', 'sfintere anale interno'],
  ['external intercostal muscle', 'muscolo intercostale esterno'],
  ['internal intercostal muscle', 'muscolo intercostale interno'],
  ['innermost intercostal muscle', 'muscolo intercostale intimo'],
  ['tendinous arch of levator ani', 'arco tendineo del elevatore dell\'ano'],
  ['thoracic rotator', 'rotatore toracico'],
  ['levator ani', 'elevatore dell\'ano'],
  ['vascular tree', 'albero vascolare'],
];

function translateEn(en) {
  if (!en) return 'Struttura anatomica';
  let s = en.trim();
  const lower = s.toLowerCase();

  // Try full / phrase replacements
  let out = lower;
  for (const [enP, itP] of PHRASES) {
    out = out.replaceAll(enP, `«${itP}»`);
  }

  // Word-by-word for remaining
  const words = out.split(/(\s+|-|\/|,)/);
  const mapped = words.map((w) => {
    if (!w || /^\s+$/.test(w) || w === '-' || w === '/' || w === ',') return w;
    if (w.startsWith('«')) return w.slice(1, -1);
    const key = w.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(TERM_IT, key)) {
      return TERM_IT[key];
    }
    return w;
  });
  let result = mapped.join('').replace(/\s+/g, ' ').trim();
  // cleanup empty articles leftovers
  result = result.replace(/\s{2,}/g, ' ').replace(/^di\s+/i, '').trim();
  // Capitalize first letter
  if (result) result = result.charAt(0).toUpperCase() + result.slice(1);
  return result || en;
}

function classifySystem(en) {
  const s = (en || '').toLowerCase();
  if (!s) return 'organi';

  // Skin first
  if (/\b(skin|dermis|epidermis|hypodermis|nail|hair follicle|sweat gland|sebaceous)\b/.test(s))
    return 'tegumentario';

  // Lymphatic
  if (/\b(lymph|lymphatic|lymph node|thoracic duct|cisterna chyli)\b/.test(s))
    return 'linfatico';

  // Nervous
  if (/\b(nerve|nervous|brain|cerebr|cerebell|thalamus|hypothalamus|brainstem|spinal cord|ganglion|plexus|neuron|meninges|dura|arachnoid|pia|cortex|gyrus|sulcus|tract|chiasm|hippocampus|amygdala|putamen|caudate|substantia|pons|medulla oblongata|midbrain|olfactory|optic|oculomotor|trochlear|trigeminal|abducens|facial|vestibulocochlear|glossopharyngeal|vagus|hypoglossal|sympathetic|parasympathetic)\b/.test(s) &&
      !/\b(artery|vein|muscle)\b/.test(s))
    return 'nervoso';
  // nerve named structures that include artery/vein words handled below first for vessels

  // Cardiovascular
  if (/\b(artery|arteries|vein|veins|aorta|heart|atrium|ventricle|valve|coronary|vascular|capillary|vena cava|pulmonary trunk|sinus of valsalva|chordae|pericardium|endocardium|myocardium)\b/.test(s))
    return 'circolatorio';

  // Respiratory
  if (/\b(lung|lungs|trachea|bronchus|bronchi|bronchiole|alveol|larynx|epiglottis|pleura|diaphragm|respiratory)\b/.test(s))
    return 'respiratorio';

  // Digestive
  if (/\b(liver|stomach|esophagus|oesophagus|intestine|colon|rectum|anus|duodenum|jejunum|ileum|cecum|appendix|gallbladder|gall bladder|pancreas|bile|digestive|pharynx|tongue|tooth|teeth|molar|premolar|canine|incisor|gingiva|salivary|parotid|submandibular|sublingual|tonsil|anal sphincter)\b/.test(s))
    return 'digestivo';

  // Urinary / reproductive
  if (/\b(kidney|renal|ureter|urethra|bladder|prostate|testis|testes|epididymis|ovary|uterus|vagina|penis|scrotum|vas deferens|seminal|fallopian|oviduct|urinary|genital|gonadal)\b/.test(s))
    return 'urinario';

  // Muscular
  if (/\b(muscle|muscles|tendon|tendinous|ligament|aponeurosis|fascia|sphincter|levator|depressor|flexor|extensor|abductor|adductor|rotator|pronator|supinator|biceps|triceps|quadriceps|gastrocnemius|soleus|gluteus|psoas|iliacus|pectoralis|trapezius|deltoid|masseter|temporalis|serratus|rhomboid|latissimus|sternocleidomastoid|scalene|splenius|semispinalis|multifidus|intercostal|spinalis|longissimus|iliocostalis|oblique|transversus|rectus abdominis|diaphragm)\b/.test(s) ||
      /\b(muscle)\b/.test(s))
    return 'muscolare';

  // Skeletal
  if (/\b(bone|bones|vertebra|vertebrae|rib|ribs|sternum|clavicle|scapula|humerus|radius|ulna|femur|tibia|fibula|patella|ilium|ischium|pubis|sacrum|coccyx|skull|cranium|mandible|maxilla|frontal|parietal|temporal bone|occipital|sphenoid|ethmoid|zygomatic|nasal bone|hyoid|cartilage|joint|articulation|metacarpal|metatarsal|phalanx|phalanges|carpal|tarsal|calcaneus|talus|navicular|cuneiform|cuboid|sesamoid|epiphysis|diaphysis|condyle|malleolus)\b/.test(s))
    return 'scheletrico';

  // Glands / organs leftover
  if (/\b(gland|thyroid|parathyroid|adrenal|pituitary|pineal|thymus|spleen|organ)\b/.test(s))
    return 'organi';

  // Nerves that also matched vessels wrongly — second pass for pure nerve names
  if (/\bnerve\b/.test(s)) return 'nervoso';

  return 'organi';
}

function describe(en, sistema) {
  const sysDesc = {
    scheletrico: 'Elemento scheletrico del modello BodyParts3D',
    muscolare: 'Struttura muscolare / tendinea del modello BodyParts3D',
    circolatorio: 'Componente del sistema cardiovascolare',
    nervoso: 'Componente del sistema nervoso',
    respiratorio: 'Componente dell\'apparato respiratorio',
    digestivo: 'Componente dell\'apparato digerente',
    urinario: 'Componente dell\'apparato urinario o riproduttivo',
    linfatico: 'Componente del sistema linfatico',
    tegumentario: 'Componente del sistema tegumentario',
    organi: 'Organo o ghiandola del modello BodyParts3D',
  };
  const base = sysDesc[sistema] || 'Struttura anatomica';
  return `${base}. Nome originale: ${en}.`;
}

function latinGuess(en) {
  // Keep English title-case as pseudo-Latin/English scientific name
  return en;
}

function parseHeader(text) {
  const get = (label) => {
    const re = new RegExp(`#\\s*${label}[ \\t]*:[ \\t]*(.*)`, 'i');
    const m = text.match(re);
    return m ? m[1].replace(/\r$/, '').trim() : '';
  };
  return {
    fileId: get('File ID'),
    bp: get('Representation ID'),
    fma: get('Concept ID'),
    en: get('English name'),
    bounds: get('Bounds\\(mm\\)'),
  };
}

function parseObj(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const headerEnd = raw.indexOf('\nv ');
  const header = headerEnd > 0 ? raw.slice(0, headerEnd + 1) : raw.slice(0, 2000);
  const meta = parseHeader(header);

  const positions = [];
  const indices = [];
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith('v ')) {
      const p = line.split(/\s+/);
      const x = parseFloat(p[1]);
      const y = parseFloat(p[2]);
      const z = parseFloat(p[3]);
      // mm → m, Z-up → Y-up: (x, z, -y)
      positions.push(x * 0.001, z * 0.001, -y * 0.001);
    } else if (line.startsWith('f ')) {
      const parts = line.split(/\s+/).slice(1).filter(Boolean);
      const face = parts.map((t) => parseInt(t.split('/')[0], 10) - 1);
      if (face.length === 3) {
        indices.push(face[0], face[1], face[2]);
      } else if (face.length === 4) {
        indices.push(face[0], face[1], face[2], face[0], face[2], face[3]);
      } else if (face.length > 4) {
        for (let i = 1; i < face.length - 1; i++) {
          indices.push(face[0], face[i], face[i + 1]);
        }
      }
    }
  }
  return { meta, positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}

function quantizePositions(positions) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    if (x < minX) minX = x; if (y < minY) minY = y; if (z < minZ) minZ = z;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y; if (z > maxZ) maxZ = z;
  }
  const sx = maxX === minX ? 1 : (maxX - minX) / 65535;
  const sy = maxY === minY ? 1 : (maxY - minY) / 65535;
  const sz = maxZ === minZ ? 1 : (maxZ - minZ) / 65535;
  const q = new Uint16Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    q[i] = Math.round((positions[i] - minX) / sx);
    q[i + 1] = Math.round((positions[i + 1] - minY) / sy);
    q[i + 2] = Math.round((positions[i + 2] - minZ) / sz);
  }
  return { q, min: [minX, minY, minZ], scale: [sx, sy, sz] };
}

function loadPartsList() {
  const map = new Map();
  if (!fs.existsSync(PARTS_LIST)) return map;
  const lines = fs.readFileSync(PARTS_LIST, 'utf8').split(/\r?\n/).slice(1);
  for (const line of lines) {
    if (!line.trim()) continue;
    const [fma, bp, en] = line.split('\t');
    if (bp) map.set(bp.trim(), { fma: (fma || '').trim(), en: (en || '').trim() });
  }
  return map;
}

console.log('Scanning OBJs in', OBJ_DIR);
const files = fs.readdirSync(OBJ_DIR).filter((f) => f.endsWith('.obj')).sort();
console.log('Found', files.length, 'OBJ files');
const bpMap = loadPartsList();

fs.mkdirSync(OUT_DIR, { recursive: true });

const parts = [];
const chunks = [];
let offset = 0;
let processed = 0;

for (const file of files) {
  const filePath = path.join(OBJ_DIR, file);
  const id = file.replace(/\.obj$/i, '');
  let { meta, positions, indices } = parseObj(filePath);

  // Fix empty metadata via M counterpart
  if (!meta.en) {
    const mPath = path.join(OBJ_DIR, id + 'M.obj');
    if (!id.endsWith('M') && fs.existsSync(mPath)) {
      const mHead = fs.readFileSync(mPath, 'utf8').slice(0, 1500);
      const mh = parseHeader(mHead);
      meta.en = mh.en ? (mh.en.match(/^left\b/i) ? mh.en : `Left ${mh.en}`) : `Structure ${id}`;
      meta.bp = meta.bp || mh.bp;
      meta.fma = meta.fma || mh.fma;
    } else {
      meta.en = `Anatomical structure ${id}`;
    }
  }

  if (meta.bp && bpMap.has(meta.bp) && !meta.en) {
    meta.en = bpMap.get(meta.bp).en;
    meta.fma = meta.fma || bpMap.get(meta.bp).fma;
  }

  const sistema = classifySystem(meta.en);
  const nome = translateEn(meta.en);

  if (positions.length < 9 || indices.length < 3) {
    console.warn('Skipping empty/invalid', id);
    continue;
  }

  // meshopt reorder + quantize
  const vertexCount = positions.length / 3;
  const indexCount = indices.length;

  const { q, min, scale } = quantizePositions(positions);
  const useUint16Index = vertexCount <= 65535;
  const indexBuf = useUint16Index
    ? Uint16Array.from(indices)
    : indices;

  // Raw quantized positions + indices (fast decode, good compression with gzip)
  const posEncoded = Buffer.from(q.buffer, q.byteOffset, q.byteLength);
  const idxEncoded = Buffer.from(indexBuf.buffer, indexBuf.byteOffset, indexBuf.byteLength);
  const posEncoding = 'quant16';
  const idxEncoding = useUint16Index ? 'u16' : 'u32';

  const posOffset = offset;
  chunks.push(posEncoded);
  offset += posEncoded.length;
  // align 4
  const pad1 = (4 - (offset % 4)) % 4;
  if (pad1) {
    chunks.push(Buffer.alloc(pad1));
    offset += pad1;
  }
  const idxOffset = offset;
  chunks.push(idxEncoded);
  offset += idxEncoded.length;
  const pad2 = (4 - (offset % 4)) % 4;
  if (pad2) {
    chunks.push(Buffer.alloc(pad2));
    offset += pad2;
  }

  parts.push({
    id,
    bp: meta.bp || '',
    fma: meta.fma || '',
    nome,
    en: meta.en,
    latino: latinGuess(meta.en),
    sistema,
    descrizione: describe(meta.en, sistema),
    vertexCount,
    indexCount,
    posOffset,
    posBytes: posEncoded.length,
    idxOffset,
    idxBytes: idxEncoded.length,
    posEncoding,
    idxEncoding,
    indexSize: useUint16Index ? 2 : 4,
    quantMin: min,
    quantScale: scale,
  });

  processed++;
  if (processed % 100 === 0) {
    console.log(`Processed ${processed}/${files.length}…`);
  }
}

const binPath = path.join(OUT_DIR, 'meshes.bin');
fs.writeFileSync(binPath, Buffer.concat(chunks));
console.log('Wrote', binPath, `(${(fs.statSync(binPath).size / 1e6).toFixed(1)} MB)`);

const counts = {};
for (const p of parts) counts[p.sistema] = (counts[p.sistema] || 0) + 1;

const catalog = {
  source: 'BodyParts3D',
  sourceUrl: 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/desc.html',
  license: 'CC BY-SA 2.1 JP',
  attribution:
    'BodyParts3D, © The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan',
  version: '4.0',
  buildLogic: 'FMA 3.0 is_a (99% reduced OBJ)',
  count: parts.length,
  countsBySystem: counts,
  bin: 'meshes.bin',
  parts,
};

const catalogPath = path.join(OUT_DIR, 'catalog.json');
fs.writeFileSync(catalogPath, JSON.stringify(catalog));
console.log('Wrote', catalogPath);
console.log('Part count:', parts.length);
console.log('By system:', counts);

// Also emit a slim TS-friendly summary for build-time imports if needed
const summaryPath = path.join(ROOT, 'src/data/catalog-meta.json');
fs.writeFileSync(
  summaryPath,
  JSON.stringify(
    {
      count: parts.length,
      countsBySystem: counts,
      attribution: catalog.attribution,
      license: catalog.license,
      source: catalog.source,
    },
    null,
    2,
  ),
);
console.log('Done.');

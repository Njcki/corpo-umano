export function classifySystem(en) {
  const s = (en || '').toLowerCase();
  if (/\b(skin|dermis|epidermis|hypodermis|nail)\b/.test(s)) return 'tegumentario';
  if (/\b(lymph|lymphatic|lymph node|thoracic duct|cisterna chyli)\b/.test(s)) return 'linfatico';
  if (/\b(artery|arteries|vein|veins|aorta|aortic|coronary|cardiac vein|vena cava|vascular tree|pericardium|endocardium|chordae|mitral|tricuspid|pulmonary valve|aortic valve|atrioventricular|cusp of)\b/.test(s)) return 'circolatorio';
  if (/\b(cavity of (left|right) (atrium|ventricle)|wall of (left|right) (atrium|ventricle)|interventricular septum|interatrial)\b/.test(s)) return 'circolatorio';
  if (/\b(lung|trachea|bronchus|bronchi|bronchial tree|bronchiole|alveol|larynx|epiglottis|pleura|respiratory)\b/.test(s)) return 'respiratorio';
  if (/\b(liver|hepatic biliary|stomach|esophagus|oesophagus|intestine|colon|rectum|anus|anal|duodenum|jejunum|ileum|cecum|appendix|gallbladder|gall bladder|pancreas|bile|tooth|teeth|molar|premolar|canine|incisor|gingiva|tongue|salivary|parotid|submandibular|sublingual|tonsil|pharynx)\b/.test(s)) return 'digestivo';
  if (/\b(kidney|ureter|urethra|bladder|prostate|testis|epididymis|ovary|uterus|vagina|penis|scrotum|urinary|renal|corpus cavernosum|corpus spongiosum|glans)\b/.test(s)) return 'urinario';
  if (/\b(nerve|ganglion|plexus|brain|cerebr|cerebell|forebrain|midbrain|spinal cord|meninges|dura|arachnoid|pia|thalamus|hypothalamus|hippocampus|amygdala|putamen|caudate|pons|medulla oblongata|optic chiasm|retina|sclera|cornea|choroid|vitreous|lens|iris|eyeball|oculomotor|trigeminal|vagus|sympathetic|olfactory|cochlea|vestibular|third ventricle|fourth ventricle|lateral ventricle|cerebral aqueduct|choroid plexus)\b/.test(s)) return 'nervoso';
  if (/\b(muscle|tendon|tendinous|ligament|fascia|aponeurosis|sphincter|biceps|triceps|quadriceps|gastrocnemius|soleus|gluteus|psoas|iliacus|pectoralis|trapezius|deltoid|masseter|temporalis|serratus|rhomboid|latissimus|sternocleidomastoid|scalene|splenius|semispinalis|multifidus|intercostal|spinalis|longissimus|iliocostalis|oblique|transversus|diaphragm|rectus|lumbrical|interosseous|interossei|flexor|extensor|abductor|adductor|rotator|pronator|supinator|teres|infraspinatus|supraspinatus|subscapularis|brachialis|brachioradialis|anconeus|iliotibial|levator|depressor|constrictor)\b/.test(s)) return 'muscolare';
  if (/\b(bone|vertebra|vertebral body|rib|sternum|clavicle|scapula|humerus|radius|ulna|femur|tibia|fibula|patella|ilium|ischium|pubis|sacrum|coccyx|skull|cranium|mandible|maxilla|cartilage|phalanx|phalanges|metacarpal|metatarsal|carpal|tarsal|calcaneus|talus|navicular|cuneiform|cuboid|hyoid|frontal bone|parietal bone|occipital bone|temporal bone|sphenoid|ethmoid|zygomatic|nasal bone|tarsal plate|cricoid|thyroid cartilage|arytenoid)\b/.test(s)) return 'scheletrico';
  if (/\b(gland|thyroid|parathyroid|adrenal|pituitary|pineal|thymus|spleen|organ|lacrimal)\b/.test(s)) return 'organi';
  return 'organi';
}

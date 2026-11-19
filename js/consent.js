// Tamil consent forms: the unit's own four templates (upper limb, lower limb, cervical spine,
// dorsolumbar spine), word for word. The form is picked from the diagnosis (or chosen on the OT
// list), and the patient's name, plan and screws are written into the blanks. Each page is drawn
// on a canvas at 200 dpi, so the phone PDF and the Mac print look exactly the same.
const CONSENT_LIMB_RISKS = (limb, limbTo, limbAcc) => [
  'மேலும், அறுவை சிகிச்சையின் போது மயக்க மருந்து கொடுப்பதால் மூச்சுத்திணறல், மாரடைப்பு மற்றும் மேசை மேல் மரணம் போன்றவை ஏற்படலாம் என அறிவேன். தேவைப்பட்டால் அறுவை சிகிச்சைக்குப் பின்னர் செயற்கை சுவாசம் பொருத்தும் நிலை வரலாம் என அறிவேன்.',
  `மேலும், இரத்த நாளங்கள் சேதம் அடைந்து அதிக இரத்தம் இழப்பு ஏற்பட வாய்ப்புள்ளது என அறிவேன். அதற்கு இரத்தம் ஏற்றும் நிலை வரலாம் என அறிவேன். அவ்வாறு ஏற்றும் இரத்தத்தினால் ஒவ்வாமை ஏற்பட்டு உயிரிழக்க வாய்ப்புள்ளது என அறிவேன். மேலும் ${limbTo} இரத்த ஓட்டம் இல்லாமல் ${limb} கருகும் நிலை வரலாம் என அறிவேன்.`,
  `மேலும், கிருமி தொற்று ஏற்பட்டு ${limb} சீழ்பிடித்து அழுகும் நிலை வரலாம் என அறிவேன். அதற்கு ${limbAcc} துண்டித்து அகற்றும் நிலை வரலாம் என அறிவேன்.`,
  `மேலும், நரம்புகள் சேதம் அடைந்து ${limb} உணர்ச்சியற்றோ மற்றும் செயல் இழந்து போகவோ வாய்ப்புள்ளது என அறிவேன்.`,
  `மேலும், {PROC} கொண்டு அறுவை சிகிச்சை செய்யும் போது எனது ${limb} எலும்புகள் உடைய வாய்ப்புள்ளது என அறிவேன். அதனைப் பொருத்த இயலாத நிலை வரலாம் என அறிவேன். அறுவை சிகிச்சைக்குப் பின்னர் எலும்புகள் கூடாமல் போகவோ தாமதமாகக் கூடவோ வாய்ப்புள்ளது என அறிவேன். மேலும் எலும்புகள் கோணலாகக் கூடி (Malunion), அதனால் ${limb} வளைந்தோ, நீளம் குறைந்தோ போக வாய்ப்புள்ளது என அறிவேன். மேலும் எலும்பில் பொருத்திய உலோகம் உடைய வாய்ப்புள்ளது என அறிவேன். தேவைப்பட்டால் மறு அறுவை சிகிச்சை செய்யும் நிலை வரலாம் என அறிவேன்.`,
  'மேலும், அறுவை சிகிச்சைக்குப் பின்னர் புண் சீழ் பிடித்தல் (SSI), இரத்தத்தில் கிருமி தொற்று ஏற்படுதல் (Septicemia) மற்றும் எலும்பில் சீழ்பிடித்தல் (Osteomyelitis) போன்ற பல சிக்கல்கள் ஏற்பட வாய்ப்புள்ளது என அறிவேன்.',
  'அனைத்து முன்னெச்சரிக்கை நடவடிக்கைகளுடன் இவ்வறுவை சிகிச்சை செய்யப்பட்டாலும், மேற்குறிப்பிட்ட ஏதேனும் ஒன்று ஏற்படுமாயின் அதற்கு மருத்துவரோ மருத்துவமனை நிர்வாகமோ பொறுப்பல்ல என்பதை ஒப்புக்கொள்கிறேன்.',
];
const CONSENT_SPINE_TAIL = (bone) => [
  'மேலும், படுத்த படுக்கையாக இருப்பதால் படுக்கைப் புண் வருவதற்கு வாய்ப்புள்ளது என அறிவேன். மேலும் காலில் உள்ள இரத்த நாளங்களில் இரத்தம் கட்டிப் போகலாம் என அறிவேன். அந்தக் கட்டி உடைந்து நுரையீரலில் உள்ள இரத்தக் குழாயை அடைத்து நெஞ்சுத்திணறல், மாரடைப்பு ஏற்படலாம் என அறிவேன்.',
  `மேலும், அறுவை சிகிச்சையின் போது {SCREW} செலுத்தும் போது எனது ${bone} எலும்பு உடைய வாய்ப்புள்ளது என அறிவேன். மேலும் எலும்பில் பொருத்திய உலோகம் வளைந்து உடையவும், விலகவும் வாய்ப்புள்ளது என அறிவேன். தேவைப்பட்டால் மறு அறுவை சிகிச்சை செய்யும் நிலை வரலாம் என அறிவேன்.`,
  'அறுவை சிகிச்சையின் போது உயிர்பிரிய வாய்ப்புள்ளது என அறிவேன்.',
  'மேலும், புண் சீழ்பிடித்தல், இரத்தத்தில் கிருமி தொற்று ஏற்படுதல், எலும்புகள் சீழ்பிடித்தல் போன்றவை ஏற்படலாம் என அறிவேன்.',
  'ஆயினும் இவ்வறுவை சிகிச்சை எனது பூரண நலன் கருதி செய்யப்படுவதால், மேற்கூறிய பின்விளைவுகள் ஏற்படுமாயின் அதற்கு மருத்துவரோ, மருத்துவமனை ஊழியரோ, நிர்வாகமோ பொறுப்பல்ல என ஒப்புக்கொள்கிறேன்.',
];
const CONSENT_BLOOD_SPINE = 'மேலும், இரத்த நாளங்கள் சேதம் அடைந்து அதிக இரத்தம் இழந்து உயிரிழக்க வாய்ப்புள்ளது என அறிவேன். அதற்கு இரத்தம் ஏற்றும் நிலை வரலாம் என அறிவேன். அவ்வாறு ஏற்றும் இரத்தத்திற்கு ஒவ்வாமை ஏற்பட்டு உயிரிழக்க வாய்ப்புள்ளது என அறிவேன்.';
const CONSENT_ANAES_SPINE = 'மேலும், மயக்க மருந்து ஒவ்வாமையால் நெஞ்சுத்திணறல், மாரடைப்பு, மேஜையில் மரணம் போன்றவை ஏற்படலாம் என அறிவேன். தேவைப்பட்டால் செயற்கை சுவாசத்தில் இருக்கும் நிலை வரலாம் என அறிவேன்.';
const CONSENT_LIMB_OPEN = (limb) => `{NAME} ஆகிய எனக்கு அடிபட்டு அரசு இராசாசி மருத்துவமனையில் அனுமதிக்கப்பட்டேன். என்னைப் பரிசோதனை செய்த மருத்துவர்கள் எனது ${limb} எலும்பு முறிவு ஏற்பட்டுள்ளது என்று கூறினர். அதற்கு {PROC} கொண்டு அறுவை சிகிச்சை செய்து சரிசெய்ய வேண்டும் என்று கூறினர். இவ்வறுவை சிகிச்சைக்கு நான் என் மனப்பூர்வ சம்மதம் அளிக்கிறேன்.`;

const CONSENT_TPLS = {
  upper: {
    label: 'Upper limb', bone: 'கை', spine: false, title: 'அறுவை சிகிச்சைக்கான ஒப்புதல் படிவம்',
    paras: [CONSENT_LIMB_OPEN('கை'), ...CONSENT_LIMB_RISKS('கை', 'கைக்கு', 'கையைத்')],
  },
  lower: {
    label: 'Lower limb', bone: 'கால்', spine: false, title: 'அறுவை சிகிச்சைக்கான ஒப்புதல் படிவம்',
    paras: [CONSENT_LIMB_OPEN('கால்'), ...CONSENT_LIMB_RISKS('கால்', 'காலுக்கு', 'காலைத்')],
  },
  cervical: {
    label: 'Cervical spine', bone: 'கழுத்து', spine: true, title: 'எடுத்துரைக்கப்பட்ட ஒப்புதல் படிவம்',
    paras: [
      '{NAME} ஆகிய எனக்கு அடிபட்டு அரசு இராசாசி மருத்துவமனையில் அனுமதிக்கப்பட்டேன். என்னைப் பரிசோதித்த மருத்துவர்கள், கழுத்து தண்டுவடத்தில் அடிபட்டு அதனால் கைகள், கால்கள் செயல் இழந்து போனது என்றும், இதற்கு {PROC} கொண்டு அறுவை சிகிச்சை செய்ய வேண்டும் என்றும் கூறினர். இவ்வறுவை சிகிச்சைக்கு நான் என் மனப்பூர்வ சம்மதம் அளிக்கிறேன்.',
      CONSENT_ANAES_SPINE + ' மேலும் செயற்கை சுவாசத்தில் இருந்து வெளியே வரமுடியாத நிலை வரலாம் என்றும், கழுத்தில் துளையிட்டு சுவாசக் குழாய் பொருத்தும் நிலை வரலாம் என்றும் அறிவேன்.',
      CONSENT_BLOOD_SPINE + ' மேலும் கழுத்து இரத்த நாளங்கள் சேதம் அடைந்து மூளைக்கு செல்லும் இரத்த ஓட்டம் பாதிக்கப்பட்டு பக்கவாதம் ஏற்படலாம் என அறிவேன்.',
      'மேலும், கழுத்தின் முன்புறம் அறுவை சிகிச்சை செய்யும் போது உணவுக்குழாய், மூச்சுக்குழாய் சேதம் அடையலாம் என்றும், குரல் மாற்றம், விழுங்குவதில் சிரமம் ஏற்படலாம் என்றும் அறிவேன். மேலும் கழுத்தில் இரத்தம் கட்டி மூச்சுத்திணறல் ஏற்படலாம் என அறிவேன். மேலும் தண்டுவட நீர் கசிவு ஏற்படலாம் என அறிவேன்.',
      'மேலும், நரம்புகள் சேதம் அடைந்து கைகள், கால்கள் நான்கும் செயல் இழந்து அல்லது உணர்ச்சியின்றி போக வாய்ப்புள்ளது என அறிவேன். அறுவை சிகிச்சைக்குப் பிறகும் நரம்பு செயல்பாடு திரும்ப வராமல் போகலாம் என அறிவேன். அதனால் படுத்த படுக்கையாக இருக்கும் நிலை வரலாம் என அறிவேன். மேலும் நரம்புகள் செயல் இழந்த காரணத்தினால் சிறுநீர், மலம் கழிப்பதில் சிரமம் ஏற்படலாம். அதனால் படுத்த படுக்கையிலேயே சிறுநீர், மலம் கழிக்கும் நிலை வரலாம் என அறிவேன்.',
      ...CONSENT_SPINE_TAIL('கழுத்து'),
    ],
  },
  dorsolumbar: {
    label: 'Dorsolumbar spine', bone: 'முதுகு', spine: true, title: 'எடுத்துரைக்கப்பட்ட ஒப்புதல் படிவம்',
    paras: [
      '{NAME} ஆகிய எனக்கு அடிபட்டு அரசு இராசாசி மருத்துவமனையில் அனுமதிக்கப்பட்டேன். என்னைப் பரிசோதித்த மருத்துவர்கள், முதுகு தண்டுவடத்தில் அடிபட்டு அதனால் கால்கள் செயல் இழந்து போனது என்றும், இதற்கு {PROC} கொண்டு அறுவை சிகிச்சை செய்ய வேண்டும் என்றும் கூறினர். இவ்வறுவை சிகிச்சைக்கு நான் என் மனப்பூர்வ சம்மதம் அளிக்கிறேன்.',
      CONSENT_ANAES_SPINE,
      CONSENT_BLOOD_SPINE,
      'மேலும், நரம்புகள் சேதம் அடைந்து கால்கள் இரண்டும் செயல் இழந்து அல்லது உணர்ச்சியின்றி போக வாய்ப்புள்ளது என அறிவேன். அறுவை சிகிச்சைக்குப் பிறகும் நரம்பு செயல்பாடு திரும்ப வராமல் போகலாம் என அறிவேன். அதனால் படுத்த படுக்கையாக இருக்கும் நிலை வரலாம் என அறிவேன். மேலும் நரம்புகள் செயல் இழந்த காரணத்தினால் சிறுநீர், மலம் கழிப்பதில் சிரமம் ஏற்படலாம். அதனால் படுத்த படுக்கையிலேயே சிறுநீர், மலம் கழிக்கும் நிலை வரலாம் என அறிவேன். மேலும் தண்டுவட நீர் கசிவு ஏற்படலாம் என அறிவேன்.',
      ...CONSENT_SPINE_TAIL('முதுகு'),
    ],
  },
};

// Implant exit: the implant paragraph is about removing it, not fixing the bone.
const CONSENT_EXIT_RE = /IMPLANT\s*(EXIT|REMOVAL)|HARDWARE\s*REMOVAL|REMOVAL\s+OF\s+(THE\s+)?(IMPLANTS?|HARDWARE|PLATES?|NAILS?|K[\s-]?WIRES?|WIRES?|SCREWS?|TBW|PFN|DHS|ILIM|IMIL|IMN|ORTHOFIX|EX\s?FIX|EXTERNAL\s+FIXATOR|JESS)|\b(PLATES?|NAILS?|K[\s-]?WIRES?|WIRES?|SCREWS?|TBW|PFN|DHS|ILIM|IMIL|IMN|ORTHOFIX|EX\s?FIX|FIXATOR|JESS|IMPLANTS?)\s+(EXIT|REMOVAL)\b|\bROI\b/;
const consentIsExit = (c) => CONSENT_EXIT_RE.test(String(c?.plan || '').toUpperCase());
const CONSENT_EXIT_PARA = (bone) => `மேலும், எலும்பில் பொருத்திய உலோகத்தை நீக்கும் போது, அதனை முழுமையாக நீக்க இயலாத நிலை வரலாம் என அறிவேன். உலோகம் அல்லது திருகாணி உடைந்து அதன் ஒரு பகுதி எலும்பிலேயே தங்கிவிட வாய்ப்புள்ளது என அறிவேன். மேலும் உலோகத்தை நீக்கும் போதோ அல்லது நீக்கிய பின்னரோ எனது ${bone} எலும்பு உடைய வாய்ப்புள்ளது என அறிவேன். அவ்வாறு உடைந்தால் அதனைச் சரிசெய்ய மறு அறுவை சிகிச்சை செய்யும் நிலை வரலாம் என அறிவேன்.`;

// Implant exit, first paragraph: which bone was broken, what was put in, and that it now has to come out.
const CONSENT_EXIT_OPEN = '{NAME} ஆகிய நான் அரசு இராசாசி மருத்துவமனையில் அனுமதிக்கப்பட்டேன். எனக்கு ஏற்கனவே {BONE} எலும்பு முறிவு ஏற்பட்டு, அதற்கு {IMPLANT} பொருத்தி அறுவை சிகிச்சை செய்யப்பட்டது. என்னைப் பரிசோதனை செய்த மருத்துவர்கள் எலும்பில் பொருத்திய உலோகத்தை நீக்க வேண்டும் என்று கூறினர். இவ்வறுவை சிகிச்சைக்கு நான் என் மனப்பூர்வ சம்மதம் அளிக்கிறேன்.';
const CONSENT_BONES = [
  [/NECK (OF )?(THE )?FEMUR|FEMORAL NECK|\bNOF\b/, 'NECK OF FEMUR'],
  [/INTER\s*TROCHANTER|\bIT (FRACTURE|FEMUR)\b/, 'INTERTROCHANTERIC FEMUR'],
  [/SUB\s*TROCHANTER/, 'SUBTROCHANTERIC FEMUR'],
  [/DISTAL FEMUR|SUPRACONDYLAR (FRACTURE )?(OF )?(THE )?FEMUR/, 'DISTAL FEMUR'],
  [/FEMUR|FEMORAL/, 'FEMUR'],
  [/TIBIAL PLATEAU|PROXIMAL TIBIA/, 'PROXIMAL TIBIA'],
  [/PILON|PLAFOND|DISTAL TIBIA/, 'DISTAL TIBIA'],
  [/BOTH BONES?( OF)?( THE)? LEG|\bBBFL\b/, 'BOTH BONES LEG'],
  [/TIBIA/, 'TIBIA'],
  [/MALLEOL|ANKLE/, 'ANKLE'],
  [/FIBULA/, 'FIBULA'],
  [/PATELLA/, 'PATELLA'],
  [/CALCAN/, 'CALCANEUM'],
  [/METATARSAL/, 'METATARSAL'],
  [/ACETABUL/, 'ACETABULUM'],
  [/PELVI/, 'PELVIS'],
  [/CLAVICLE/, 'CLAVICLE'],
  [/PROXIMAL HUMER|SURGICAL NECK/, 'PROXIMAL HUMERUS'],
  [/DISTAL HUMER|SUPRACONDYLAR (FRACTURE )?(OF )?(THE )?HUMER|INTERCONDYLAR/, 'DISTAL HUMERUS'],
  [/HUMER/, 'HUMERUS'],
  [/OLECRANON/, 'OLECRANON'],
  [/BOTH BONES?( OF)?( THE)? FOREARM|\bBBFA\b/, 'BOTH BONES FOREARM'],
  [/DISTAL RADIUS|DISTAL END (OF )?RADIUS|COLLES|SMITH|BARTON/, 'DISTAL RADIUS'],
  [/RADIUS|RADIAL/, 'RADIUS'],
  [/ULNA/, 'ULNA'],
  [/METACARPAL/, 'METACARPAL'],
  [/SCAPHOID/, 'SCAPHOID'],
];
const CONSENT_IMPLANTS = [
  [/\bPFNA?\b|PROXIMAL FEMORAL NAIL/, 'PFN'],
  [/\bDHS\b|DYNAMIC HIP/, 'DHS'],
  [/\bDCS\b/, 'DCS'],
  [/\bTENS\b|ELASTIC NAIL/, 'TENS NAILS'],
  [/ILIM|IMIL|\bIMN\b|INTRAMEDULLARY|INTERLOCK|\bNAIL/, 'INTRAMEDULLARY INTERLOCKING NAIL'],
  [/\bTBW\b|TENSION BAND/, 'TENSION BAND WIRING'],
  [/\bCC\s*SCREW|CANNULATED/, 'CANNULATED SCREWS'],
  [/PEDICLE|\bPSF\b/, 'PEDICLE SCREWS AND RODS'],
  [/EX\s?FIX|EXTERNAL FIXATOR|ORTHOFIX|\bJESS\b|ILIZAROV|\bLRS\b/, 'EXTERNAL FIXATOR'],
  [/PLATE|PLATING|\bLCP\b|\bDCP\b/, 'PLATE AND SCREWS'],
  [/K[\s-]?WIRE/, 'K-WIRES'],
  [/SCREW/, 'SCREWS'],
];
const consentSide = (t) => (/\b(BILATERAL|B\/L)\b/.test(t) ? 'BILATERAL ' : /\b(LEFT|LT)\b/.test(t) ? 'LEFT ' : /\b(RIGHT|RT)\b/.test(t) ? 'RIGHT ' : '');
function consentExitBone(c) {
  if (String(c.exitBone || '').trim()) return c.exitBone;
  const dx = String(c.diagnosis || '').toUpperCase();
  const vert = /\b([CDTL]\d{1,2})\b/.exec(dx);
  if (vert) return `${vert[1]} VERTEBRA`;
  const hit = CONSENT_BONES.find(([re]) => re.test(dx));
  return hit ? consentSide(dx) + hit[1] : '';
}
function consentExitImplant(c) {
  if (String(c.exitImplant || '').trim()) return c.exitImplant;
  for (const t of [c.plan, c.diagnosis, c.implants]) {
    const hit = CONSENT_IMPLANTS.find(([re]) => re.test(String(t || '').toUpperCase()));
    if (hit) return hit[1];
  }
  return '';
}

// Which form: chosen on the OT list (c.consentTpl), else from the diagnosis, then the plan.
const CONSENT_RE = {
  cervical: /CERVICAL|\bC[1-7](\s*[-–/]\s*C?[1-7])?\b|ODONTOID|\bDENS\b|ATLAS|\bAXIS\b|HANGMAN|JEFFERSON|\bACDF\b|LATERAL MASS|OCCIPITO/,
  spine: /SPINE|SPINAL|VERTEBRA|DORSAL|THORACIC|LUMBAR|THORACOLUMBAR|DORSOLUMBAR|\b[DTL]\s?\d{1,2}\b|BURST|CHANCE|PEDICLE|LAMINECTOMY|\bPSF\b|TLIF|PLIF|SPONDYL|POTT|PARAPLEGI|PARAPARESIS|\bSCI\b/,
  upper: /CLAVICLE|SHOULDER|HUMER|ELBOW|OLECRANON|CORONOID|RADIUS|RADIAL|ULNA|FOREARM|WRIST|SCAPHOID|CARPAL|METACARPAL|HAND|FINGER|THUMB|MONTEGGIA|GALEAZZI|COLLES|SMITH|BARTON|SCAPULA|ACROMIO|\bAC JOINT|BENNETT|BOXER|UPPER LIMB|\bBBFA\b|\bDER\b|SUPRACONDYLAR HUMER/,
  lower: /FEMUR|FEMORAL|\bNOF\b|TROCHANTER|\bHIP\b|ACETABUL|PELVI|TIBIA|TIBIAL|FIBULA|PLATEAU|PILON|PLAFOND|KNEE|PATELLA|ANKLE|MALLEOL|BIMALLEOLAR|TRIMALLEOLAR|FOOT|CALCAN|TALUS|TALAR|LISFRANC|METATARSAL|\bTOE|\bLEG\b|LOWER LIMB|\bBBFL\b/,
};
function consentKind(c) {
  if (c && CONSENT_TPLS[c.consentTpl]) return c.consentTpl;
  for (const text of [c?.diagnosis, c?.plan]) {
    const t = String(text || '').toUpperCase();
    if (!t.trim()) continue;
    if (CONSENT_RE.cervical.test(t)) return 'cervical';
    if (CONSENT_RE.spine.test(t)) return 'dorsolumbar';
    const up = CONSENT_RE.upper.test(t);
    const low = CONSENT_RE.lower.test(t);
    if (up && !low) return 'upper';
    if (low) return 'lower';
  }
  return 'lower';
}

// The screws named in the spine forms' "____ செலுத்தும் போது" blank (left blank if not known).
function consentScrews(c) {
  const t = String(`${c.implants || ''} ${c.plan || ''}`).toUpperCase();
  const m = /(PEDICLE|LATERAL MASS|TRANSARTICULAR|ODONTOID|CERVICAL|LAG)\s+SCREWS?/.exec(t);
  if (m) return `${m[1]} SCREW`;
  if (/\bPSF\b|PEDICLE|POSTERIOR STABILI[SZ]ATION|\bTLIF\b|\bPLIF\b/.test(t)) return 'PEDICLE SCREW';
  if (/\bACDF\b|ANTERIOR CERVICAL/.test(t)) return 'PLATE AND SCREW';
  return '';
}

const ConsentForm = (() => {
  const DPI = 200;
  const W = Math.round(210 / 25.4 * DPI);
  const H = Math.round(297 / 25.4 * DPI);
  const MM = DPI / 25.4;
  const PT = DPI / 72;
  const SERIF = '"Noto Serif Tamil", "Tamil Sangam MN", "Latha", "Nirmala UI", "Noto Sans Tamil", serif';

  async function fontsReady() {
    try {
      await Promise.race([
        Promise.all(['400', '700'].map((w) => document.fonts.load(`${w} 20px "Noto Serif Tamil"`, 'அ'))),
        new Promise((r) => setTimeout(r, 3000)),
      ]);
    } catch { /* system Tamil font it is */ }
  }

  // Paragraph → words; a filled blank is bold + underlined, an empty one a ruled line.
  function tokens(text, fills) {
    const out = [];
    for (const w of text.split(/\s+/).filter(Boolean)) {
      const m = /^\{(\w+)\}(.*)$/.exec(w);
      if (!m) { out.push({ t: w }); continue; }
      const v = String(fills[m[1]] || '').trim().toUpperCase();
      if (v) {
        const ws = v.split(/\s+/);
        ws.forEach((x, i) => out.push({ t: x + (i === ws.length - 1 ? m[2] : ''), fill: true }));
      } else out.push({ blank: m[1] === 'NAME' ? 42 : 38, t: m[2] });
    }
    return out;
  }

  // Draw one page; `pt` is the body size. Returns the y where the page content ends.
  function draw(g, c, draft, pt) {
    const tpl = CONSENT_TPLS[consentKind(c)];
    const M = 12.7 * MM;
    const CW = W - 2 * M;
    const font = (size, weight = 400) => { g.font = `${weight} ${size * PT}px ${SERIF}`; };
    const rule = (x, y, w) => g.fillRect(x, y, w, Math.max(2, PT * 0.6));
    const center = (text, y) => g.fillText(text, (W - g.measureText(text).width) / 2, y);
    g.fillStyle = '#fff';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#000';
    g.strokeStyle = '#000';
    let y = 10 * MM;

    // Header
    font(14, 700); y += 14 * PT; center('அரசு இராசாசி மருத்துவமனை, மதுரை', y);
    font(10); y += 16 * PT; center('எலும்பு முறிவு சிகிச்சைத் துறை — Department of Orthopaedics', y);
    font(12, 700); y += 19 * PT;
    center(`${tpl.title}${tpl.spine ? ' — High Risk Consent' : ''}${c.standby ? '  (STANDBY)' : ''}`, y);
    y += 3 * MM;

    // Details box: Name / Age, Sex, IP No / Diagnosis / Plan
    const bpt = 10;
    const pad = 2 * MM;
    const blh = bpt * PT * 1.4;
    const labWidth = (l) => { font(bpt, 700); return Math.max(30 * MM, g.measureText(l).width + 2 * pad); };
    g.lineWidth = Math.max(2, PT * 0.6);
    const box = (cells) => {
      // cells: [[label, value, width], ...]; widths add up to CW
      font(bpt);
      const lines = cells.map(([l, v, w]) => wrap(g, String(v || '').toUpperCase(), w - labWidth(l) - 2 * pad));
      const rh = Math.max(1, ...lines.map((l) => l.length)) * blh + 2.2 * pad;
      let x = M;
      cells.forEach(([label, , w], i) => {
        font(bpt, 700);
        const labW = labWidth(label);
        g.fillText(label, x + pad, y + pad + bpt * PT);
        font(bpt);
        lines[i].forEach((ln, j) => g.fillText(ln, x + labW + pad, y + pad + bpt * PT + j * blh));
        g.strokeRect(x, y, labW, rh);
        g.strokeRect(x + labW, y, w - labW, rh);
        x += w;
      });
      y += rh;
    };
    box([['பெயர் / Name', c.name, CW]]);
    const sexW = (CW) * 0.36;
    const ipW = CW * 0.3;
    box([['வயது / Age', c.age, CW - sexW - ipW], ['பாலினம் / Sex', c.sex === 'M' ? 'MALE' : c.sex === 'F' ? 'FEMALE' : c.sex, sexW], ['IP No.', c.ipNo, ipW]]);
    box([['Diagnosis', c.diagnosis, CW]]);
    box([['Plan', c.plan, CW]]);
    y += 4 * MM;

    // Body: justified, first-line indent; blanks filled in bold + underline.
    const lh = pt * PT * 1.5;
    const indent = 10 * MM;
    const fills = { NAME: c.name, PROC: c.plan, SCREW: consentScrews(c), BONE: consentExitBone(c), IMPLANT: consentExitImplant(c) };
    const width = (tk) => {
      font(pt, tk.fill ? 700 : 400);
      return (tk.blank ? tk.blank * MM + (tk.t ? g.measureText(tk.t).width : 0) : g.measureText(tk.t).width);
    };
    const exit = consentIsExit(c);
    const paras = tpl.paras.map((t, i) => (!exit ? t : i === 0 ? CONSENT_EXIT_OPEN : /கொண்டு அறுவை சிகிச்சை செய்யும் போது|\{SCREW\} செலுத்தும்/.test(t) ? CONSENT_EXIT_PARA(tpl.bone) : t));
    for (const p of paras) {
      const tks = tokens(p, fills);
      const lines = [];
      let line = [];
      let lw = 0;
      font(pt);
      const space = g.measureText(' ').width;
      for (const tk of tks) {
        const w = width(tk);
        const lim = CW - (lines.length ? 0 : indent);
        if (line.length && lw + space + w > lim) { lines.push(line); line = []; lw = 0; }
        lw += (line.length ? space : 0) + w;
        line.push(tk);
      }
      if (line.length) lines.push(line);
      lines.forEach((ln, i) => {
        const x0 = M + (i ? 0 : indent);
        const avail = CW - (i ? 0 : indent);
        const ws = ln.map(width);
        const gap = i < lines.length - 1 && ln.length > 1 ? (avail - ws.reduce((a, b) => a + b, 0)) / (ln.length - 1) : space;
        let x = x0;
        const base = y + pt * PT * 1.05;
        ln.forEach((tk, k) => {
          if (tk.blank) {
            rule(x, base + 1.2 * PT, tk.blank * MM);
            if (tk.t) { font(pt); g.fillText(tk.t, x + tk.blank * MM, base); }
          } else {
            font(pt, tk.fill ? 700 : 400);
            g.fillText(tk.t, x, base);
            if (tk.fill) rule(x, base + 1.6 * PT, ws[k] + (ln[k + 1]?.fill ? gap : 0));
          }
          x += ws[k] + gap;
        });
        y += lh;
      });
      y += 1.6 * MM;
    }

    // Three ruled lines for anything added by hand (above the signatures, so it is signed for).
    g.fillStyle = '#555';
    for (let i = 0; i < 3; i++) {
      y += 8 * MM;
      g.fillRect(M, y, CW, Math.max(1.5, PT * 0.45));
    }
    g.fillStyle = '#000';
    y += 1 * MM;

    // Date, "இப்படிக்கு," and the two signature blocks
    const spt = 10;
    const slh = spt * PT * 1.45;
    font(spt);
    const date = `நாள் / Date: ${draft.date ? fmtDate(draft.date) : ''}`;
    const dx = tpl.spine ? M + CW - g.measureText(date).width : M;
    y += slh * 0.4;
    g.fillText(date, dx, y + spt * PT);
    if (!draft.date) rule(dx + g.measureText('நாள் / Date: ').width, y + spt * PT + 2, 30 * MM);
    y += slh;
    const by = 'இப்படிக்கு,';
    g.fillText(by, M + CW - g.measureText(by).width, y + spt * PT);
    y += slh + 13 * MM;
    const bw = 68 * MM;
    rule(M, y, bw);
    rule(M + CW - bw, y, bw);
    y += 1.5 * MM;
    const right = (text, yy) => g.fillText(text, M + CW - g.measureText(text).width, yy);
    const rows = tpl.spine
      ? [['சாட்சி / Witness', 'நோயாளி / Patient', 700], ['பெயர் / Name:', 'பெயர் / Name:', 400], ['கையொப்பம் / பெருவிரல் ரேகை', 'கையொப்பம் / பெருவிரல் ரேகை', 400]]
      : [['சாட்சி கையொப்பம் / Witness Signature', 'நோயாளியின் கையொப்பம் / Patient Signature', 700], ['பெயர் / Name:', '(கையொப்பம் / கைரேகை)', 400], ['உறவுமுறை / Relation:', '', 400]];
    for (const [l, r, wgt] of rows) {
      font(spt, wgt);
      g.fillText(l, M, y + spt * PT);
      if (r) right(r, y + spt * PT);
      y += slh;
    }
    return y;
  }

  function wrap(g, text, width) {
    const out = [];
    let line = '';
    for (const word of String(text ?? '').split(/\s+/).filter(Boolean)) {
      const t = line ? line + ' ' + word : word;
      if (g.measureText(t).width <= width || !line) line = t;
      else { out.push(line); line = word; }
    }
    if (line) out.push(line);
    return out.length ? out : [''];
  }

  // One A4 page per case; the body text shrinks a little if a long diagnosis would push it off.
  function page(c, draft) {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');
    g.textBaseline = 'alphabetic';
    const bottom = H - 8 * MM;
    for (let pt = 11; pt >= 8; pt -= 0.25) {
      if (draw(g, c, draft, pt) <= bottom || pt <= 8) break;
    }
    return cv;
  }

  return { page, fontsReady, kind: consentKind, isExit: consentIsExit, exitBone: consentExitBone, exitImplant: consentExitImplant, label: (c) => CONSENT_TPLS[consentKind(c)].label };
})();

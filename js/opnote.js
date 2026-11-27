// Operative note builder — trauma. Pick the fracture, side, anaesthesia, position, approach and
// implants; the rest (approach steps, structures incised / retracted / protected, reduction,
// fixation, C-arm check, closure) is written from the library below. The note is a draft: the
// surgeon reads and edits it before saving.

const OPN_CATEGORIES = [
  ['trauma', 'Trauma'], ['spine', 'Spine'], ['arthroplasty', 'Arthroplasty'], ['arthroscopy', 'Arthroscopy'], ['tumour', 'Tumour'], ['paediatrics', 'Paediatrics'],
  ['general', 'Others (debridement, implant removal, amputation…)'],
];

const OPN_ANAES = ['SPINAL ANAESTHESIA', 'COMBINED SPINAL EPIDURAL ANAESTHESIA', 'GENERAL ANAESTHESIA', 'SUPRACLAVICULAR BRACHIAL PLEXUS BLOCK', 'INFRACLAVICULAR BRACHIAL PLEXUS BLOCK', 'AXILLARY BRACHIAL PLEXUS BLOCK', 'INTERSCALENE BLOCK', 'REGIONAL BLOCK WITH GENERAL ANAESTHESIA', 'LOCAL ANAESTHESIA'];
const OPN_POSITIONS = ['SUPINE', 'SUPINE ON FRACTURE TABLE', 'SUPINE WITH ARM ON HAND TABLE', 'SUPINE WITH SANDBAG UNDER IPSILATERAL HIP', 'SUPINE WITH KNEE FLEXED OVER BOLSTER', 'BEACH CHAIR', 'LATERAL', 'LATERAL WITH ARM OVER BOLSTER', 'PRONE', 'PRONE WITH ARM OVER BOLSTER', 'PRONE ON BOLSTERS', 'LATERAL DECUBITUS', 'SUPINE WITH ARTHROSCOPY LEG HOLDER', 'SUPINE WITH NECK EXTENDED'];
const OPN_SCREWS = ['3.5MM CORTICAL SCREWS', '4.5MM CORTICAL SCREWS', '2.7MM CORTICAL SCREWS', '3.5MM LOCKING SCREWS', '5MM LOCKING SCREWS', '2.4MM LOCKING SCREWS', '4MM CANCELLOUS SCREWS', '6.5MM CANCELLOUS SCREWS (PARTIALLY THREADED)', '4MM CANNULATED CANCELLOUS SCREWS', '6.5MM CANNULATED CANCELLOUS SCREWS', '7MM CANNULATED CANCELLOUS SCREWS', '4.9MM LOCKING BOLTS', '5MM LOCKING BOLTS', '3.9MM LOCKING BOLTS', '4.9MM DISTAL LOCKING BOLTS',
  '8MM LAG SCREW', '10.5MM LAG SCREW', '12.5MM DHS LAG SCREW', '6.4MM ANTI-ROTATION SCREW', '6.5MM ANTI-ROTATION SCREW', 'HELICAL BLADE',
  '3MM HERBERT SCREWS', '2.4MM HERBERT SCREWS', '1.5MM K-WIRES', '1.8MM K-WIRES', '2MM K-WIRES', '2.5MM K-WIRES', '18G SS WIRE',
  '4.5MM SCHANZ PINS', '5MM SCHANZ PINS', '6MM SCHANZ PINS', '3MM STEINMANN PINS', '4MM STEINMANN PINS',
  'AO CLAMPS', 'AO RODS', 'CONNECTING CLAMPS', 'T-CLAMPS',
  'PEDICLE SCREWS', '3.5MM SUTURE ANCHORS', '5MM SUTURE ANCHORS', '7MM INTERFERENCE SCREW', '8MM INTERFERENCE SCREW', '9MM INTERFERENCE SCREW', 'CORTICAL BUTTON (ENDOBUTTON)'];
// The menus each kind of implant gets: nails proximal then distal locking; plates screws proximal / distal to
// the fracture + lag screws; PFN lag + anti-rotation screw then distal bolts; DHS lag screw + shaft screws.
const OPN_BOLTS = ['4.9MM LOCKING BOLTS', '5MM LOCKING BOLTS', '4.5MM LOCKING BOLTS', '3.9MM LOCKING BOLTS', '6.4MM LOCKING BOLTS'];
const OPN_PLATE_SCREWS = ['4.5MM CORTICAL SCREWS', '5MM LOCKING SCREWS', '3.5MM CORTICAL SCREWS', '3.5MM LOCKING SCREWS', '2.7MM CORTICAL SCREWS', '2.4MM LOCKING SCREWS', '4MM CANCELLOUS SCREWS', '6.5MM CANCELLOUS SCREWS'];
const OPN_LAG_SCREWS = ['4.5MM CORTICAL SCREW', '3.5MM CORTICAL SCREW', '2.7MM CORTICAL SCREW', '4MM CANCELLOUS SCREW', '6.5MM CANCELLOUS SCREW (PARTIALLY THREADED)', '4MM CANNULATED CANCELLOUS SCREW'];
// External fixator: pins in each main fragment, then the frame (the department's AO set)
const OPN_EXFIX_PINS = ['4.5MM SCHANZ PINS', '5MM SCHANZ PINS', '6MM SCHANZ PINS', '4MM STEINMANN PINS'];
const OPN_EXFIX_FRAME = ['AO CLAMPS', 'AO RODS', 'CONNECTING CLAMPS', 'T-CLAMPS'];
const OPN_SPINE_SCREWS = ['PEDICLE SCREWS', 'LATERAL MASS SCREWS', 'CORTICAL BONE TRAJECTORY SCREWS', 'ILIAC SCREWS', 'LAMINAR HOOKS'];
const OPN_SPINE_SIDES = [['BILATERAL', 'Both sides'], ['RIGHT', 'Right'], ['LEFT', 'Left']];
function opnScrewSections(imp) {
  const k = opnImp(imp)?.k;
  const bolts = (at, title) => ({ at, title, types: OPN_BOLTS, add: [[`+ ${title.toLowerCase().replace(/^\w/, (c) => c.toUpperCase())} bolts`, OPN_BOLTS[0]]] });
  if (k === 'nail') return [bolts('PROXIMAL', 'Proximal locking'), bolts('DISTAL', 'Distal locking')];
  if (k === 'pfn') {
    return [{ at: 'NECK', title: 'Proximally — into the neck', one: true, types: ['8MM LAG SCREW', '10.5MM LAG SCREW', '6.4MM ANTI-ROTATION SCREW', '6.5MM ANTI-ROTATION SCREW', 'HELICAL BLADE'],
      add: imp.implant === 'pfna' ? [['+ Helical blade', 'HELICAL BLADE']] : [['+ Lag screw (8mm)', '8MM LAG SCREW'], ['+ Anti-rotation screw (6.4mm)', '6.4MM ANTI-ROTATION SCREW']] },
    bolts('DISTAL', 'Distal locking')];
  }
  if (k === 'dhs') {
    return [{ at: 'NECK', title: 'Lag screw', one: true, types: ['12.5MM DHS LAG SCREW', '8MM LAG SCREW'], add: [['+ Lag screw (12.5mm)', '12.5MM DHS LAG SCREW']] },
      { at: 'SHAFT', title: 'Screws to the shaft (side plate)', types: OPN_PLATE_SCREWS, add: [['+ Shaft screws', '4.5MM CORTICAL SCREWS']] }];
  }
  if (k === 'plate' || k === 'mipo') {
    const small = /3\.5|2\.0|2\.4|mini|volar|radius|clavic|olecranon|1\/3|tubular|fibula|recon|philos|radial|symph|pelvic|calcan|T-plate/i.test(opnImp(imp).label);
    const def = small ? '3.5MM CORTICAL SCREWS' : '4.5MM CORTICAL SCREWS';
    return [{ at: 'PROXIMAL', title: 'Screws proximal to the fracture', types: OPN_PLATE_SCREWS, add: [['+ Proximal screws', def]] },
      { at: 'DISTAL', title: 'Screws distal to the fracture', types: OPN_PLATE_SCREWS, add: [['+ Distal screws', def]] },
      { at: 'ACROSS FRACTURE', title: 'Lag screws (across the fracture)', types: OPN_LAG_SCREWS, add: [['+ Lag screw', small ? '3.5MM CORTICAL SCREW' : '4.5MM CORTICAL SCREW']] }];
  }
  if (k === 'exfix' && imp.implant !== 'ilizarov') {
    return [{ at: 'PROXIMAL', title: 'Schanz pins — proximal fragment', types: OPN_EXFIX_PINS, add: [['+ Proximal pins', '4.5MM SCHANZ PINS']] },
      { at: 'DISTAL', title: 'Schanz pins — distal fragment', types: OPN_EXFIX_PINS, add: [['+ Distal pins', '4.5MM SCHANZ PINS']] },
      { at: 'FRAME', title: 'Frame', types: OPN_EXFIX_FRAME, add: [['+ AO clamps', 'AO CLAMPS'], ['+ AO rods', 'AO RODS'], ['+ Connecting clamps', 'CONNECTING CLAMPS'], ['+ T-clamps', 'T-CLAMPS']] }];
  }
  return null; // anything else: free rows with a "where" choice
}
// Lengths typed as "34" or "34, 36" → ['34', '36']; something else (e.g. "6.5 X 45") → null (written as typed).
const opnLens = (len) => {
  const t = String(len || '').toUpperCase().trim();
  if (!t) return [];
  if (/[A-Z]/.test(t.replace(/MM\b/g, ''))) return null;
  return t.split(/[,;/\s]+/).map((x) => x.replace(/MM$/, '')).filter(Boolean);
};
// "2 X 4.9MM LOCKING BOLTS OF SIZE 34MM EACH" / "… OF SIZE 34MM AND 36MM" / "LAG SCREW OF SIZE 90MM"
function opnScrewSay(s) {
  const n = String(s.n || '').trim();
  const lens = opnLens(s.len);
  const size = lens === null ? ` of size ${String(s.len).trim()}` : lens.length === 1 ? ` of size ${lens[0]}mm${+n > 1 ? ' each' : ''}` : lens.length ? ` of size ${opnJoin(lens.map((l) => `${l}mm`))}` : '';
  return `${n ? `${n} X ` : ''}${opnOne(s, opnScrewType(s))}${size}`;
}
const opnCount = (g) => g.reduce((a, s) => a + (+s.n || 1), 0);
const opnSayList = (g) => opnJoin(g.map(opnScrewSay));

// Where a group of screws goes; used to place them in the right sentence of the note.
const OPN_SCREW_AT = [['PROXIMAL', 'Proximal'], ['DISTAL', 'Distal'], ['NECK', 'Neck / head'], ['SHAFT', 'Shaft'], ['ACROSS FRACTURE', 'Across fracture (lag)'], ['FRAME', 'Frame']];

// ---- Approaches: what is done between incision and the fracture.
// pos = usual position, tq = tourniquet usually used, closed = closed / percutaneous technique.
const OPN_APPROACHES = {
  clavSup: { label: 'Superior approach to clavicle', pos: 'BEACH CHAIR', tq: false, surface: 'superior', steps: [
    'Incision made along the subcutaneous border of the clavicle centred over the fracture site.',
    'Supraclavicular nerve branches identified and preserved as far as possible.',
    'Platysma and clavipectoral fascia incised in line with the incision and the fracture site exposed with minimal periosteal stripping, staying on bone inferiorly to protect the subclavian vessels and brachial plexus.'] },
  deltopectoral: { label: 'Deltopectoral approach', pos: 'BEACH CHAIR', tq: false, steps: [
    'Incision made from the tip of the coracoid process along the deltopectoral groove.',
    'Cephalic vein identified and retracted laterally with the deltoid; pectoralis major retracted medially.',
    'Clavipectoral fascia incised lateral to the conjoint tendon, which was retracted medially taking care of the musculocutaneous nerve.',
    'Long head of biceps identified and used as the landmark between the tuberosities; axillary nerve protected inferiorly. Rotator cuff tendons tagged with stay sutures.'] },
  deltoidSplit: { label: 'Deltoid-splitting (anterolateral) approach', pos: 'BEACH CHAIR', tq: false, steps: [
    'Incision made from the anterolateral corner of the acromion distally.',
    'Deltoid split in line with its fibres between the anterior and middle raphe, not more than 5 cm distal to the acromion; axillary nerve identified on the deep surface of the deltoid and protected.',
    'Rotator cuff tendons tagged with stay sutures to control the tuberosities.'] },
  humAnterolat: { label: 'Anterolateral approach to humerus', pos: 'SUPINE WITH ARM ON HAND TABLE', tq: false, surface: 'anterolateral', steps: [
    'Incision made along the lateral border of the biceps over the fracture.',
    'Biceps retracted medially exposing the brachialis.',
    'Brachialis split longitudinally between its lateral one-third (radial nerve supply) and medial two-thirds (musculocutaneous nerve supply).',
    'Radial nerve identified distally between brachialis and brachioradialis and protected throughout the procedure.'] },
  humPosterior: { label: 'Posterior (triceps-splitting) approach to humerus', pos: 'PRONE WITH ARM OVER BOLSTER', tq: false, surface: 'posterior', steps: [
    'Posterior midline incision made over the arm.',
    'Interval between the long and lateral heads of triceps developed proximally and the medial head split in the midline.',
    'Radial nerve with the profunda brachii vessels identified in the spiral groove, mobilised and protected with a vessel loop throughout; ulnar nerve protected distally.'] },
  humDistPost: { label: 'Posterior approach with chevron olecranon osteotomy', pos: 'LATERAL WITH ARM OVER BOLSTER', tq: true, steps: [
    'Posterior midline incision made, curving radially around the tip of the olecranon.',
    'Full thickness fasciocutaneous flaps raised. Ulnar nerve identified in the cubital tunnel, mobilised and protected with a vessel loop.',
    'Olecranon predrilled and a chevron osteotomy (apex distal) made at the bare area with an oscillating saw and completed with an osteotome; olecranon with triceps reflected proximally, exposing the distal humeral articular surface.'] },
  humParatricipital: { label: 'Paratricipital (triceps-sparing) approach', pos: 'LATERAL WITH ARM OVER BOLSTER', tq: true, steps: [
    'Posterior midline incision made over the elbow.',
    'Ulnar nerve identified and protected. Windows developed on the medial and lateral sides of the triceps, elevating it off the posterior humerus without detaching its insertion.',
    'Radial nerve protected proximally on the lateral side.'] },
  elbowLateral: { label: 'Lateral (Kocher) approach to elbow', pos: 'SUPINE WITH ARM ON HAND TABLE', tq: true, steps: [
    'Incision made from the lateral epicondyle extending distally over the radial head.',
    'Interval between anconeus and extensor carpi ulnaris developed, with the forearm kept in pronation to protect the posterior interosseous nerve.',
    'Capsule and annular ligament incised anterior to the lateral collateral ligament, exposing the fracture.'] },
  elbowMedial: { label: 'Medial approach to elbow', pos: 'SUPINE WITH ARM ON HAND TABLE', tq: true, steps: [
    'Incision made centred over the medial epicondyle.',
    'Ulnar nerve identified posterior to the medial epicondyle and protected throughout.',
    'Fracture fragment with the attached flexor-pronator origin identified and cleaned.'] },
  olecPosterior: { label: 'Posterior approach to olecranon', pos: 'LATERAL WITH ARM OVER BOLSTER', tq: true, steps: [
    'Posterior longitudinal incision made over the subcutaneous border of the ulna, curving around the tip of the olecranon.',
    'Ulnar nerve palpated in the cubital tunnel and protected.',
    'Fracture exposed with minimal periosteal stripping; haematoma and interposed tissue removed from the joint.'] },
  henry: { label: 'Volar (Henry) approach to radius', pos: 'SUPINE WITH ARM ON HAND TABLE', tq: true, surface: 'volar', steps: [
    'Incision made along the line from the biceps tendon to the radial styloid over the fracture.',
    'Interval between brachioradialis (radial nerve) and flexor carpi radialis / pronator teres (median nerve) developed.',
    'Superficial radial nerve protected under the brachioradialis and the radial artery retracted.',
    'Supinator detached from its insertion with the forearm in supination to protect the posterior interosseous nerve proximally; pronator teres / pronator quadratus elevated as required to expose the fracture.'] },
  thompson: { label: 'Dorsal (Thompson) approach to radius', pos: 'SUPINE WITH ARM ON HAND TABLE', tq: true, surface: 'dorsal', steps: [
    'Incision made from the lateral epicondyle towards Lister\'s tubercle over the fracture.',
    'Interval between extensor carpi radialis brevis and extensor digitorum communis developed.',
    'Posterior interosseous nerve identified in the supinator and protected; abductor pollicis longus and extensor pollicis brevis retracted.'] },
  ulnaSubcut: { label: 'Subcutaneous approach to ulna', pos: 'SUPINE WITH ARM ON HAND TABLE', tq: true, surface: 'subcutaneous (posteromedial) border of the ulna', steps: [
    'Incision made along the subcutaneous border of the ulna centred over the fracture.',
    'Interval between extensor carpi ulnaris and flexor carpi ulnaris developed.',
    'Periosteum elevated minimally; dorsal branch of the ulnar nerve protected distally.'] },
  forearmBoth: { label: 'Volar (Henry) approach to radius + subcutaneous approach to ulna', pos: 'SUPINE WITH ARM ON HAND TABLE', tq: true, both: 'one on the volar surface of the radius and one on the subcutaneous border of the ulna', bothSurfaces: ['volar surface of the radius', 'subcutaneous border of the ulna'], targets: ['Radius', 'Ulna'], steps: [
    'Ulna exposed first through a subcutaneous incision along its border, in the interval between extensor carpi ulnaris and flexor carpi ulnaris, with minimal periosteal stripping.',
    'Radius exposed through a separate volar (Henry) incision from the biceps tendon towards the radial styloid, in the interval between brachioradialis and flexor carpi radialis.',
    'Superficial radial nerve protected under the brachioradialis and the radial artery retracted; supinator detached in supination to protect the posterior interosseous nerve; pronator teres elevated as required.'] },
  distRadVolar: { label: 'Volar (FCR) approach to distal radius', pos: 'SUPINE WITH ARM ON HAND TABLE', tq: true, steps: [
    'Longitudinal incision made over the flexor carpi radialis tendon.',
    'FCR sheath incised and the tendon retracted ulnarly; radial artery retracted radially.',
    'Floor of the FCR sheath incised and flexor pollicis longus retracted ulnarly.',
    'Pronator quadratus incised in an L-shape from its radial border and elevated, exposing the fracture.'] },
  distRadDorsal: { label: 'Dorsal approach to distal radius', pos: 'SUPINE WITH ARM ON HAND TABLE', tq: true, surface: 'dorsal', steps: [
    'Longitudinal dorsal incision made in line with Lister\'s tubercle.',
    'Extensor retinaculum opened over the third compartment and extensor pollicis longus transposed radially.',
    'Second and fourth compartments elevated subperiosteally to expose the fracture.'] },
  percKwire: { label: 'Closed reduction and percutaneous K-wiring', pos: 'SUPINE WITH ARM ON HAND TABLE', tq: false, closed: true, steps: [
    'Closed reduction achieved by traction and manipulation under C-arm guidance.',
    'K-wires passed percutaneously through stab incisions, taking care to avoid the neurovascular structures, and position confirmed in AP and lateral views.'] },
  handDorsal: { label: 'Dorsal approach (metacarpal / phalanx)', pos: 'SUPINE WITH ARM ON HAND TABLE', tq: true, steps: [
    'Longitudinal dorsal incision made over the fracture.',
    'Dorsal sensory nerve branches protected; extensor tendon retracted (or split for the phalanx).',
    'Periosteum incised and elevated to expose the fracture.'] },
  exfixUL: { label: 'External fixator (upper limb)', pos: 'SUPINE WITH ARM ON HAND TABLE', tq: false, closed: true, steps: [
    'Closed reduction achieved by traction and manipulation under C-arm guidance.',
    'Pins inserted through small stab incisions with blunt dissection down to bone and drill sleeves, avoiding neurovascular structures.'] },
  pfannenstiel: { label: 'Pfannenstiel approach', pos: 'SUPINE', tq: false, steps: [
    'Urinary catheter in situ. Transverse incision made 2 cm above the pubic symphysis.',
    'Rectus sheath incised transversely and the recti split in the midline; bladder protected in the space of Retzius with a malleable retractor.',
    'Symphysis exposed; spermatic cord / round ligament protected laterally.'] },
  kocherLangenbeck: { label: 'Kocher-Langenbeck approach', pos: 'PRONE', tq: false, steps: [
    'Curved incision made centred over the greater trochanter, extending proximally towards the posterior superior iliac spine.',
    'Fascia lata incised and gluteus maximus split in line with its fibres.',
    'Sciatic nerve identified and protected with the knee flexed and hip extended. Short external rotators detached and tagged, protecting the medial femoral circumflex artery; quadratus femoris preserved.',
    'Posterior wall / column exposed and the fracture cleaned.'] },
  hipPosterior: { label: 'Posterior (Moore / Southern) approach to hip', pos: 'LATERAL', tq: false, steps: [
    'Curved incision made centred over the posterior aspect of the greater trochanter.',
    'Fascia lata incised and gluteus maximus split in line with its fibres.',
    'Sciatic nerve palpated and protected. Short external rotators (piriformis, superior gemellus, obturator internus, inferior gemellus) detached close to their insertion and tagged.',
    'Capsule incised in a T-shape and the fracture exposed.'] },
  hipAnterolat: { label: 'Anterolateral (Hardinge) approach to hip', pos: 'LATERAL', tq: false, steps: [
    'Longitudinal incision made centred over the greater trochanter.',
    'Fascia lata incised in line with the incision.',
    'Anterior one-third of gluteus medius and vastus lateralis elevated in continuity, keeping the split within 5 cm of the trochanter to protect the superior gluteal nerve.',
    'Capsule incised and the fracture exposed.'] },
  proxFemClosed: { label: 'Closed reduction on fracture table (cephalomedullary nail)', pos: 'SUPINE ON FRACTURE TABLE', tq: false, closed: true, steps: [
    'Closed reduction achieved by traction, abduction and internal rotation under C-arm guidance and confirmed in AP and lateral views.',
    'Longitudinal incision made proximal to the tip of the greater trochanter; fascia of gluteus medius split in line with its fibres.'] },
  proxFemLateral: { label: 'Lateral approach to proximal femur', pos: 'SUPINE ON FRACTURE TABLE', tq: false, steps: [
    'Closed reduction achieved on the fracture table and confirmed under C-arm in AP and lateral views.',
    'Lateral longitudinal incision made from the vastus ridge distally.',
    'Fascia lata split and vastus lateralis elevated off the lateral intermuscular septum; perforating vessels ligated.'] },
  femNailClosed: { label: 'Closed antegrade interlocking nailing', pos: 'SUPINE ON FRACTURE TABLE', tq: false, closed: true, steps: [
    'Closed reduction achieved by traction and manipulation under C-arm guidance.',
    'Incision made proximal to the tip of the greater trochanter; gluteus maximus fascia split and entry point made at the piriformis fossa / tip of the greater trochanter with an awl.'] },
  femLateral: { label: 'Lateral approach to femur', pos: 'SUPINE WITH SANDBAG UNDER IPSILATERAL HIP', tq: false, surface: 'lateral', steps: [
    'Lateral longitudinal incision made over the fracture.',
    'Iliotibial band split in line with the incision.',
    'Vastus lateralis elevated off the lateral intermuscular septum and retracted anteriorly; perforating vessels identified and ligated.'] },
  distFemLateral: { label: 'Lateral approach to distal femur', pos: 'SUPINE WITH KNEE FLEXED OVER BOLSTER', tq: false, steps: [
    'Lateral incision made centred over the lateral femoral condyle and extended proximally along the femur.',
    'Iliotibial band split; vastus lateralis elevated off the lateral intermuscular septum and perforators ligated.',
    'Lateral arthrotomy made to visualise the articular surface where the fracture was intra-articular.'] },
  retroNail: { label: 'Retrograde nailing (transpatellar tendon entry)', pos: 'SUPINE WITH KNEE FLEXED OVER BOLSTER', tq: false, closed: true, steps: [
    'Knee flexed to 30-40 degrees over a bolster. Short incision made over the patellar tendon and the tendon split in line with its fibres.',
    'Entry point made at the intercondylar notch just anterior to the posterior cruciate ligament insertion under C-arm guidance.'] },
  patellaAnt: { label: 'Anterior midline approach to patella', pos: 'SUPINE', tq: true, steps: [
    'Midline longitudinal incision made over the patella.',
    'Prepatellar bursa incised and the fracture exposed; knee joint washed of haematoma.',
    'Medial and lateral retinacular tears noted.'] },
  plateauAntLat: { label: 'Anterolateral approach to tibial plateau', pos: 'SUPINE WITH KNEE FLEXED OVER BOLSTER', tq: true, steps: [
    'Lazy-S incision made from the lateral femoral epicondyle over Gerdy\'s tubercle along the anterior crest of the tibia.',
    'Iliotibial band split / elevated off Gerdy\'s tubercle and tibialis anterior elevated subperiosteally from the lateral tibia.',
    'Submeniscal arthrotomy made, lateral meniscus tagged and lifted to visualise the articular surface.'] },
  plateauPostMed: { label: 'Posteromedial approach to tibial plateau', pos: 'PRONE', tq: true, steps: [
    'Incision made along the posteromedial border of the proximal tibia.',
    'Interval between the medial head of gastrocnemius and pes anserinus developed; saphenous nerve and vein protected.',
    'Popliteus elevated as required to expose the posteromedial fragment.'] },
  tibNailClosed: { label: 'Closed interlocking nailing (infrapatellar entry)', pos: 'SUPINE WITH KNEE FLEXED OVER BOLSTER', tq: false, closed: true, steps: [
    'Closed reduction achieved by traction and manipulation under C-arm guidance.',
    'Knee flexed; longitudinal incision made over the patellar tendon and the tendon split / retracted.',
    'Entry point made just medial to the lateral tibial spine on AP and at the anterior edge of the tibial plateau on lateral view.'] },
  tibMipoMedial: { label: 'Medial MIPO approach to tibia', pos: 'SUPINE', tq: true, steps: [
    'Small incision made over the medial malleolus; long saphenous vein and saphenous nerve identified and protected.',
    'Extraperiosteal submuscular tunnel created along the medial tibia.',
    'Fracture reduced closed by traction and manipulation under C-arm guidance.'] },
  pilonAntMed: { label: 'Anteromedial approach to distal tibia', pos: 'SUPINE', tq: true, steps: [
    'Incision made just lateral to the tibial crest, curving medially over the medial malleolus.',
    'Tibialis anterior tendon sheath preserved and retracted laterally; saphenous vein and nerve protected.',
    'Anteromedial capsule opened to visualise the articular surface.'] },
  pilonAntLat: { label: 'Anterolateral approach to distal tibia', pos: 'SUPINE', tq: true, steps: [
    'Incision made in line with the fourth metatarsal over the ankle.',
    'Superficial peroneal nerve identified and protected.',
    'Interval lateral to the extensor digitorum longus developed; anterior neurovascular bundle retracted medially; anterolateral capsule opened.'] },
  ankleLateral: { label: 'Lateral approach to fibula', pos: 'SUPINE WITH SANDBAG UNDER IPSILATERAL HIP', tq: true, steps: [
    'Longitudinal incision made along the posterior border of the fibula over the fracture.',
    'Superficial peroneal nerve protected anteriorly in the proximal part of the wound.',
    'Fracture exposed with minimal periosteal stripping; peroneal tendons protected posteriorly.'] },
  ankleMedial: { label: 'Medial approach to medial malleolus', pos: 'SUPINE', tq: true, steps: [
    'Curvilinear incision made centred over the medial malleolus.',
    'Long saphenous vein and saphenous nerve identified and protected.',
    'Interposed periosteum removed from the fracture site and the joint inspected.'] },
  ankleBoth: { label: 'Lateral approach to fibula + medial approach to medial malleolus', pos: 'SUPINE', tq: true, surface: 'lateral surface of the fibula', targets: ['Lateral malleolus', 'Medial malleolus'], steps: [
    'Fibula exposed first through a longitudinal incision along its posterior border, protecting the superficial peroneal nerve anteriorly and the peroneal tendons posteriorly.',
    'Medial malleolus exposed through a curvilinear incision, protecting the long saphenous vein and saphenous nerve; interposed periosteum removed from the fracture site.'] },
  calcSinusTarsi: { label: 'Sinus tarsi approach', pos: 'LATERAL', tq: true, steps: [
    'Incision made from the tip of the lateral malleolus towards the base of the fourth metatarsal.',
    'Peroneal tendons retracted plantarward; sural nerve protected inferiorly.',
    'Fat pad of the sinus tarsi elevated to expose the posterior facet.'] },
  calcExtensile: { label: 'Extensile lateral (L-shaped) approach', pos: 'LATERAL', tq: true, steps: [
    'L-shaped incision made with the vertical limb anterior to the Achilles tendon and the horizontal limb along the junction of the lateral and plantar skin.',
    'Full thickness subperiosteal flap raised containing the sural nerve and peroneal tendons, held with K-wires (no-touch technique).',
    'Lateral wall reflected to expose the depressed posterior facet.'] },
  exfixLL: { label: 'External fixator (lower limb)', pos: 'SUPINE', tq: false, closed: true, steps: [
    'Wound debrided as required.',
    'Closed reduction achieved by traction and manipulation under C-arm guidance.',
    'Schanz pins inserted through small stab incisions with blunt dissection down to bone, using drill sleeves and avoiding neurovascular structures.'] },
};

// ---- Implants: what the fixation paragraph says. k = kind (decides the text).
const OPN_IMPLANTS = {
  // plates
  clavLcp: { label: 'Precontoured superior clavicle LCP', k: 'plate', surface: 'superior' },
  recon35: { label: '3.5mm reconstruction plate', k: 'plate' },
  lateralClav: { label: 'Anatomical lateral clavicle locking plate', k: 'plate', surface: 'superior' },
  hookPlate: { label: 'Clavicular hook plate', k: 'plate', surface: 'superior' },
  philos: { label: 'PHILOS (proximal humerus locking plate)', k: 'plate', surface: 'lateral, lateral to the bicipital groove and 5-8mm distal to the tip of the greater tuberosity' },
  narrowLcp: { label: '4.5mm narrow LCP', k: 'plate' },
  narrowDcp: { label: '4.5mm narrow DCP', k: 'plate' },
  dualDistHum: { label: 'Dual precontoured distal humerus locking plates', k: 'plate', surface: 'medial and posterolateral (orthogonal)' },
  olecLcp: { label: 'Precontoured olecranon locking plate', k: 'plate', surface: 'posterior' },
  radHeadPlate: { label: 'Radial head mini locking plate', k: 'plate', surface: 'non-articular (safe zone)' },
  dcp35: { label: '3.5mm DCP', k: 'plate' },
  lcdcp35: { label: '3.5mm LC-DCP', k: 'plate' },
  lcp35: { label: '3.5mm LCP', k: 'plate' },
  volarLock: { label: 'Volar locking distal radius plate', k: 'plate', surface: 'volar, proximal to the watershed line' },
  tPlate: { label: 'T-plate (distal radius)', k: 'plate' },
  miniPlate: { label: '2.0 / 2.4mm mini plate', k: 'plate', surface: 'dorsal' },
  symphysisPlate: { label: '3.5mm symphyseal reconstruction plate', k: 'plate', surface: 'superior' },
  pelvicRecon: { label: '3.5mm pelvic reconstruction plate', k: 'plate', surface: 'posterior' },
  broadLcp: { label: '4.5mm broad LCP', k: 'plate', surface: 'lateral' },
  broadDcp: { label: '4.5mm broad DCP', k: 'plate', surface: 'lateral' },
  dflp: { label: 'Distal femur locking plate (DFLP)', k: 'plate', surface: 'lateral' },
  condButtress: { label: 'Condylar buttress plate', k: 'plate', surface: 'lateral' },
  ptlLcp: { label: 'Lateral proximal tibia locking plate', k: 'plate', surface: 'anterolateral' },
  medButtress: { label: 'Medial buttress plate', k: 'plate', surface: 'posteromedial' },
  ltButtress: { label: 'L / T buttress plate', k: 'plate' },
  mdtLcp: { label: 'Medial distal tibia LCP', k: 'mipo', surface: 'medial' },
  aldtPlate: { label: 'Anterolateral distal tibia plate', k: 'plate', surface: 'anterolateral' },
  oneThird: { label: '1/3 tubular plate', k: 'plate', surface: 'lateral / posterolateral' },
  fibLcp: { label: 'Distal fibula locking plate', k: 'plate', surface: 'lateral' },
  calcPlate: { label: 'Calcaneal locking plate', k: 'plate', surface: 'lateral' },
  // nails
  phn: { label: 'Proximal humerus nail', k: 'nail', bone: 'humerus' },
  humNail: { label: 'Humerus interlocking nail', k: 'nail', bone: 'humerus' },
  femNail: { label: 'Femur interlocking nail', k: 'nail', bone: 'femur' },
  retroFemNail: { label: 'Retrograde femur nail', k: 'nail', bone: 'femur' },
  tibNail: { label: 'Tibia interlocking nail', k: 'nail', bone: 'tibia' },
  tens: { label: 'TENS (titanium elastic nails)', k: 'tens' },
  rush: { label: 'Rush nail', k: 'tens' },
  shortPfn: { label: 'Short PFN', k: 'pfn' },
  longPfn: { label: 'Long PFN', k: 'pfn' },
  pfna: { label: 'PFNA', k: 'pfn' },
  // other
  dhs: { label: 'DHS with side plate', k: 'dhs' },
  dcs: { label: 'DCS (dynamic condylar screw)', k: 'dhs' },
  ccNeck: { label: 'Cannulated cancellous screws (neck of femur)', k: 'ccNeck' },
  ccScrews: { label: 'Cannulated cancellous screws', k: 'screws' },
  herbert: { label: 'Herbert screws', k: 'screws' },
  screwsOnly: { label: 'Lag screws only', k: 'screws' },
  tbw: { label: 'Tension band wiring (2 K-wires + SS wire)', k: 'tbw' },
  ccTbw: { label: 'Cannulated screws + tension band', k: 'tbw' },
  kwires: { label: 'K-wires', k: 'kwire' },
  exfix: { label: 'External fixator', k: 'exfix' },
  exfixUni: { label: 'Uniplanar external fixator', k: 'exfix' },
  ilizarov: { label: 'Ilizarov ring fixator', k: 'exfix' },
  bipolar: { label: 'Bipolar hemiarthroplasty prosthesis', k: 'hemi' },
  amp: { label: 'Austin Moore prosthesis', k: 'hemi' },
  cemThompson: { label: 'Cemented Thompson prosthesis', k: 'hemi' },
  radHeadExc: { label: 'Radial head excision', k: 'excision' },
  partialPatellectomy: { label: 'Partial patellectomy with tendon repair', k: 'patellectomy' },
  syndesmotic: { label: 'Syndesmotic screw', k: 'screws' },
};

// ---- Bones and fracture sites → the approaches and implants that fit.
// Each site: [label, approaches[], implants[], suggested screws[]]
const S = (label, ap, im, sc = []) => ({ label, ap, im, sc });
const OPN_TRAUMA = {
  upper: { label: 'Upper limb', anaes: 'SUPRACLAVICULAR BRACHIAL PLEXUS BLOCK', bones: {
    clavicle: { label: 'Clavicle', sites: {
      mid: S('Midshaft', ['clavSup'], ['clavLcp', 'recon35', 'lcp35', 'tens'], ['3.5MM LOCKING SCREWS', '3.5MM CORTICAL SCREWS']),
      lat: S('Lateral end', ['clavSup'], ['lateralClav', 'hookPlate', 'tbw'], ['2.4MM LOCKING SCREWS', '3.5MM CORTICAL SCREWS']),
    } },
    proxHumerus: { label: 'Proximal humerus', sites: {
      neck: S('Surgical neck (2-part)', ['deltopectoral', 'deltoidSplit'], ['philos', 'phn', 'kwires'], ['3.5MM LOCKING SCREWS', '3.5MM CORTICAL SCREWS']),
      three: S('3-part', ['deltopectoral', 'deltoidSplit'], ['philos', 'phn'], ['3.5MM LOCKING SCREWS', '3.5MM CORTICAL SCREWS']),
      four: S('4-part', ['deltopectoral'], ['philos'], ['3.5MM LOCKING SCREWS', '3.5MM CORTICAL SCREWS']),
      gt: S('Greater tuberosity', ['deltoidSplit', 'deltopectoral'], ['ccScrews', 'screwsOnly'], ['4MM CANNULATED CANCELLOUS SCREWS']),
    } },
    humShaft: { label: 'Shaft of humerus', sites: {
      prox: S('Proximal third', ['humAnterolat'], ['narrowLcp', 'humNail', 'narrowDcp'], ['4.5MM CORTICAL SCREWS', '5MM LOCKING SCREWS']),
      mid: S('Middle third', ['humAnterolat', 'humPosterior'], ['narrowLcp', 'narrowDcp', 'humNail', 'tens'], ['4.5MM CORTICAL SCREWS', '5MM LOCKING SCREWS']),
      dist: S('Distal third', ['humPosterior'], ['narrowLcp', 'narrowDcp'], ['4.5MM CORTICAL SCREWS', '5MM LOCKING SCREWS']),
    } },
    distHumerus: { label: 'Distal humerus', sites: {
      bicol: S('Intercondylar (bicolumn)', ['humDistPost', 'humParatricipital'], ['dualDistHum'], ['3.5MM LOCKING SCREWS', '3.5MM CORTICAL SCREWS']),
      supra: S('Supracondylar (extra-articular)', ['humParatricipital', 'percKwire'], ['dualDistHum', 'kwires'], ['3.5MM LOCKING SCREWS', 'K-WIRES']),
      latCond: S('Lateral condyle', ['elbowLateral'], ['kwires', 'ccScrews'], ['K-WIRES', '4MM CANNULATED CANCELLOUS SCREWS']),
      medEpi: S('Medial epicondyle', ['elbowMedial'], ['ccScrews', 'kwires'], ['4MM CANNULATED CANCELLOUS SCREWS']),
      capit: S('Capitellum', ['elbowLateral'], ['herbert'], ['HERBERT SCREWS']),
    } },
    olecranon: { label: 'Olecranon', sites: {
      trans: S('Transverse', ['olecPosterior'], ['tbw', 'olecLcp'], ['K-WIRES', '18G SS WIRE']),
      comm: S('Comminuted', ['olecPosterior'], ['olecLcp'], ['3.5MM LOCKING SCREWS', '3.5MM CORTICAL SCREWS']),
    } },
    radHead: { label: 'Radial head / neck', sites: {
      head: S('Radial head', ['elbowLateral'], ['herbert', 'radHeadPlate', 'radHeadExc'], ['HERBERT SCREWS']),
      neck: S('Radial neck', ['elbowLateral'], ['radHeadPlate', 'kwires'], ['2.4MM LOCKING SCREWS']),
    } },
    forearm: { label: 'Radius & ulna shaft', sites: {
      both: S('Both bones forearm', ['forearmBoth'], ['dcp35', 'lcdcp35', 'lcp35', 'tens'], ['3.5MM CORTICAL SCREWS']),
      radius: S('Radius alone', ['henry', 'thompson'], ['dcp35', 'lcdcp35', 'lcp35'], ['3.5MM CORTICAL SCREWS']),
      ulna: S('Ulna alone', ['ulnaSubcut'], ['dcp35', 'lcdcp35', 'lcp35'], ['3.5MM CORTICAL SCREWS']),
      galeazzi: S('Galeazzi', ['henry'], ['dcp35', 'lcp35'], ['3.5MM CORTICAL SCREWS', 'K-WIRES']),
      monteggia: S('Monteggia', ['ulnaSubcut'], ['dcp35', 'lcp35'], ['3.5MM CORTICAL SCREWS']),
    } },
    distRadius: { label: 'Distal radius', sites: {
      extra: S('Extra-articular', ['distRadVolar', 'percKwire', 'exfixUL'], ['volarLock', 'kwires', 'exfix'], ['2.4MM LOCKING SCREWS', 'K-WIRES']),
      intra: S('Intra-articular', ['distRadVolar', 'distRadDorsal', 'exfixUL'], ['volarLock', 'tPlate', 'exfix'], ['2.4MM LOCKING SCREWS', '3.5MM CORTICAL SCREWS']),
      barton: S('Volar Barton / Smith', ['distRadVolar'], ['volarLock', 'tPlate'], ['2.4MM LOCKING SCREWS', '3.5MM CORTICAL SCREWS']),
    } },
    hand: { label: 'Metacarpal / phalanx', sites: {
      mc: S('Metacarpal', ['handDorsal', 'percKwire'], ['miniPlate', 'kwires'], ['2.4MM LOCKING SCREWS', 'K-WIRES']),
      ph: S('Phalanx', ['handDorsal', 'percKwire'], ['miniPlate', 'kwires'], ['K-WIRES']),
    } },
  } },
  lower: { label: 'Lower limb', anaes: 'SPINAL ANAESTHESIA', bones: {
    pelvis: { label: 'Pelvis / acetabulum', sites: {
      symph: S('Pubic symphysis diastasis', ['pfannenstiel'], ['symphysisPlate'], ['3.5MM CORTICAL SCREWS']),
      postWall: S('Acetabulum — posterior wall', ['kocherLangenbeck'], ['pelvicRecon', 'screwsOnly'], ['3.5MM CORTICAL SCREWS']),
    } },
    proxFemur: { label: 'Proximal femur', sites: {
      nof: S('Neck of femur', ['hipPosterior', 'hipAnterolat', 'proxFemLateral'], ['bipolar', 'amp', 'cemThompson', 'ccNeck'], ['6.5MM CANNULATED CANCELLOUS SCREWS']),
      it: S('Intertrochanteric', ['proxFemClosed', 'proxFemLateral'], ['shortPfn', 'pfna', 'dhs'], ['4.9MM DISTAL LOCKING BOLTS']),
      subtroch: S('Subtrochanteric', ['proxFemClosed'], ['longPfn', 'pfna'], ['4.9MM DISTAL LOCKING BOLTS']),
    } },
    femShaft: { label: 'Shaft of femur', sites: {
      prox: S('Proximal third', ['femNailClosed', 'femLateral'], ['femNail', 'broadLcp'], ['4.9MM DISTAL LOCKING BOLTS']),
      mid: S('Middle third', ['femNailClosed', 'femLateral'], ['femNail', 'broadLcp', 'broadDcp'], ['4.9MM DISTAL LOCKING BOLTS']),
      dist: S('Distal third', ['femNailClosed', 'femLateral', 'retroNail'], ['femNail', 'retroFemNail', 'broadLcp'], ['4.9MM DISTAL LOCKING BOLTS']),
    } },
    distFemur: { label: 'Distal femur', sites: {
      supra: S('Supracondylar (extra-articular)', ['distFemLateral', 'retroNail'], ['dflp', 'retroFemNail', 'dcs'], ['5MM LOCKING SCREWS', '4.5MM CORTICAL SCREWS']),
      inter: S('Intercondylar', ['distFemLateral'], ['dflp', 'condButtress'], ['5MM LOCKING SCREWS', '6.5MM CANCELLOUS SCREWS (PARTIALLY THREADED)']),
    } },
    patella: { label: 'Patella', sites: {
      trans: S('Transverse', ['patellaAnt'], ['tbw', 'ccTbw'], ['K-WIRES', '18G SS WIRE']),
      comm: S('Comminuted', ['patellaAnt'], ['tbw', 'partialPatellectomy'], ['K-WIRES', '18G SS WIRE']),
      pole: S('Inferior pole', ['patellaAnt'], ['partialPatellectomy', 'tbw'], ['18G SS WIRE']),
    } },
    plateau: { label: 'Tibial plateau', sites: {
      lat: S('Lateral plateau (Schatzker I-III)', ['plateauAntLat'], ['ptlLcp', 'ltButtress', 'ccScrews'], ['3.5MM LOCKING SCREWS', '6.5MM CANCELLOUS SCREWS (PARTIALLY THREADED)']),
      med: S('Medial plateau (Schatzker IV)', ['plateauPostMed'], ['medButtress', 'ccScrews'], ['3.5MM CORTICAL SCREWS', '6.5MM CANCELLOUS SCREWS (PARTIALLY THREADED)']),
      bicond: S('Bicondylar (Schatzker V-VI)', ['plateauAntLat', 'plateauPostMed'], ['ptlLcp', 'medButtress', 'exfix'], ['3.5MM LOCKING SCREWS', '3.5MM CORTICAL SCREWS']),
    } },
    tibShaft: { label: 'Shaft of tibia', sites: {
      prox: S('Proximal third', ['tibNailClosed', 'exfixLL'], ['tibNail', 'exfix'], ['4.9MM DISTAL LOCKING BOLTS']),
      mid: S('Middle third', ['tibNailClosed', 'exfixLL'], ['tibNail', 'exfixUni', 'ilizarov'], ['4.9MM DISTAL LOCKING BOLTS']),
      dist: S('Distal third', ['tibNailClosed', 'tibMipoMedial', 'exfixLL'], ['tibNail', 'mdtLcp', 'exfix'], ['4.9MM DISTAL LOCKING BOLTS', '3.5MM LOCKING SCREWS']),
    } },
    pilon: { label: 'Distal tibia (pilon)', sites: {
      pilon: S('Pilon', ['pilonAntMed', 'pilonAntLat', 'exfixLL'], ['mdtLcp', 'aldtPlate', 'exfix'], ['3.5MM LOCKING SCREWS', '3.5MM CORTICAL SCREWS']),
    } },
    ankle: { label: 'Ankle', sites: {
      lat: S('Lateral malleolus', ['ankleLateral'], ['oneThird', 'fibLcp', 'screwsOnly'], ['3.5MM CORTICAL SCREWS', '4MM CANCELLOUS SCREWS']),
      med: S('Medial malleolus', ['ankleMedial'], ['ccScrews', 'tbw'], ['4MM CANNULATED CANCELLOUS SCREWS']),
      bimal: S('Bimalleolar', ['ankleBoth'], ['oneThird', 'fibLcp', 'ccScrews', 'tbw'], ['3.5MM CORTICAL SCREWS', '4MM CANNULATED CANCELLOUS SCREWS']),
      trimal: S('Trimalleolar', ['ankleBoth'], ['oneThird', 'fibLcp', 'ccScrews', 'tbw'], ['3.5MM CORTICAL SCREWS', '4MM CANNULATED CANCELLOUS SCREWS']),
    } },
    calcaneum: { label: 'Calcaneum', sites: {
      jd: S('Joint depression', ['calcSinusTarsi', 'calcExtensile'], ['calcPlate', 'ccScrews'], ['3.5MM LOCKING SCREWS']),
      tongue: S('Tongue type', ['calcSinusTarsi'], ['ccScrews', 'calcPlate'], ['6.5MM CANNULATED CANCELLOUS SCREWS']),
    } },
  } },
};

const OPN_SLABS = ['NONE', 'ABOVE ELBOW SLAB', 'BELOW ELBOW SLAB', 'ABOVE KNEE SLAB', 'BELOW KNEE SLAB', 'ARM POUCH', 'U-SLAB', 'LONG KNEE BRACE'];

// Look-ups for the builder
const opnBones = (region) => OPN_TRAUMA[region]?.bones || {};
const opnSite = (b) => OPN_TRAUMA[b.region]?.bones[b.bone]?.sites[b.site];
const opnBoneLabel = (b) => OPN_TRAUMA[b.region]?.bones[b.bone]?.label || '';

// ---- The note (one sitting: shared anaesthesia, one or more procedures, each with one or more implants)
// Model: { v: 2, cat, anaes, procs: [ { region, bone, site, side, position, tourniquet, approach, drain, slab,
//          implants: [ { implant, implantCustom, size, screws: [ { type, n, custom } ] } ] } ] }

// Older saves were one flat procedure.
function opnNormalize(b) {
  if (!b) return null;
  if (b.procs) { b.procs.forEach((p) => { p.cat ||= b.cat || 'trauma'; }); return b; }
  return {
    v: 2, cat: b.cat || 'trauma', anaes: b.anaes || '',
    procs: [{
      cat: b.cat || 'trauma', region: b.region || '', bone: b.bone || '', site: b.site || '', side: b.side || '', position: b.position || '', tourniquet: b.tourniquet || 'no',
      approach: b.approach || '', drain: b.drain || 'no', slab: b.slab || 'NONE',
      implants: [{ implant: b.implant || '', implantCustom: b.implantCustom || '', size: b.size || '', screws: b.screws || [] }],
    }],
  };
}

const opnImp = (i) => (i.implant === 'custom' ? { label: i.implantCustom || 'IMPLANT', k: 'plate' } : OPN_IMPLANTS[i.implant]);
// Screw length(s): "40" → "40MM", "36, 38 40" → "36, 38, 40MM". Nothing typed → nothing written.
const opnLen = (len) => {
  const t = String(len || '').toUpperCase().trim();
  if (!t) return '';
  // anything other than plain numbers ("6.5 X 45") is written as typed
  if (/[A-Z]/.test(t.replace(/MM\b/g, ''))) return /\d$/.test(t) ? `${t}MM` : t;
  const parts = t.split(/[,;/\s]+/).map((x) => x.replace(/MM$/, '')).filter(Boolean);
  return parts.length ? `${parts.join(', ')}MM` : '';
};
const opnScrewType = (s) => (s.type === 'custom' ? (s.custom || '') : s.type || '').trim();
// One of them: "4.9MM LOCKING BOLTS" → "4.9MM LOCKING BOLT" (when the number is 1)
const opnOne = (s, t) => (String(s.n || '').trim() === '1' ? t.replace(/\b(BOLT|SCREW|WIRE|PIN|ANCHOR|HOOK|BLADE|CLAMP|ROD)S\b/i, '$1') : t);
// "3 X 3.5MM LOCKING SCREWS (36, 38, 40MM)" — without its position (the sentence says where).
const opnScrewBase = (s) => {
  const len = opnLen(s.len);
  const where = `${s.level ? ` at ${String(s.level).trim()}` : ''}${s.side ? (s.side === 'BILATERAL' ? ' bilaterally' : ` on the ${String(s.side).toLowerCase()} side`) : ''}`;
  return `${s.n ? s.n + ' X ' : ''}${opnOne(s, opnScrewType(s))}${len ? ` (${len})` : ''}${where}`.trim();
};
const opnScrews = (i) => (i.screws || []).filter((s) => opnScrewType(s));
// For the IMPLANTS line: with its position.
const opnScrewList = (i) => opnScrews(i).map((s) => `${opnScrewBase(s)}${s.at ? ` - ${s.at}` : ''}`).filter(Boolean);
const opnJoin = (arr) => (arr.length > 1 ? `${arr.slice(0, -1).join(', ')} and ${arr.at(-1)}` : arr[0] || '');
const OPN_AT_WORD = { PROXIMAL: 'proximally', DISTAL: 'distally', NECK: 'into the neck and head', SHAFT: 'to the shaft', 'ACROSS FRACTURE': 'across the fracture' };
// "proximally with A, distally with B and with C"
function opnFixWith(screws) {
  const order = ['PROXIMAL', 'DISTAL', 'NECK', 'SHAFT', 'ACROSS FRACTURE', ''];
  const parts = order.map((at) => [at, screws.filter((x) => (x.at || '') === at)]).filter(([, g]) => g.length)
    .map(([at, g]) => `${at ? OPN_AT_WORD[at] + ' ' : ''}with ${opnJoin(g.map(opnScrewBase))}`);
  return opnJoin(parts);
}
const opnImpName = (i) => [String(i.size || '').trim(), opnImp(i)?.label].filter(Boolean).join(' ');

// One procedure → its name, implant list and the body lines.
function opnProc(p) {
  if (p.cat && p.cat !== 'trauma') return opnTplProc(p);
  const U = (s) => String(s || '').toUpperCase();
  const site = opnSite(p);
  const ap = OPN_APPROACHES[p.approach];
  const imps = (p.implants || []).filter((i) => opnImp(i));
  if (!site || !ap || !imps.length) return null;
  const side = U(p.side);
  const boneName = opnBoneLabel(p).replace(/ & /g, ' AND ').replace(/\s*shaft$/i, '').replace(/^Shaft of /i, '');
  const kinds = imps.map((i) => opnImp(i).k);
  const names = imps.map(opnImpName);

  let name;
  const first = imps[0];
  if (kinds[0] === 'hemi') name = `${opnImp(first).label.replace(/\s*(hemiarthroplasty\s*)?prosthesis$/i, '')} HEMIARTHROPLASTY ${side} HIP${first.size ? ` (${String(first.size).trim()})` : ''}`;
  else if (kinds.every((k) => k === 'exfix')) name = `${names.join(' AND ')} APPLICATION ${side} ${boneName}`;
  else if (kinds[0] === 'excision') name = `RADIAL HEAD EXCISION ${side}`;
  else if (kinds[0] === 'patellectomy') name = `PARTIAL PATELLECTOMY WITH TENDON REPAIR ${side}`;
  else name = `${ap.closed ? 'CLOSED' : 'OPEN'} REDUCTION AND INTERNAL FIXATION WITH ${names.join(' AND ')} ${side} ${boneName}`;

  const L = [];
  if (!ap.closed) L.push(`${ap.label}:`);
  ap.steps.forEach((s) => L.push(s));
  const openReduce = 'Fracture haematoma evacuated and the fracture ends cleaned of interposed soft tissue and freshened. Fracture reduced anatomically under direct vision and held temporarily with reduction clamps / K-wires.';
  let reduced = false;
  const reduce = (txt = openReduce) => { if (!reduced) { L.push(txt); reduced = true; } };
  const plates = imps.filter((i) => ['plate'].includes(opnImp(i).k));
  let plateNo = 0;

  imps.forEach((i) => {
    const imp = opnImp(i);
    const impName = opnImpName(i);
    const size = String(i.size || '').trim();
    const sc = opnScrews(i);
    const screwText = opnJoin(sc.map(opnScrewBase));
    const scr = sc.length ? ` and fixed ${opnFixWith(sc)}` : '';
    const at = (w) => sc.filter((x) => x.at === w);
    const notAt = (...w) => sc.filter((x) => !w.includes(x.at || ''));
    const list = (g) => opnJoin(g.map(opnScrewBase));
    switch (imp.k) {
      case 'plate': {
        reduce();
        const lag = at('ACROSS FRACTURE');
        if (lag.length) L.push(`Fracture compressed with ${opnSayList(lag)} placed as lag screw${opnCount(lag) > 1 ? 's' : ''} across the fracture.`);
        const pdParts = [at('PROXIMAL').length && `${opnSayList(at('PROXIMAL'))} proximal to the fracture`, at('DISTAL').length && `${opnSayList(at('DISTAL'))} distal to the fracture`,
          notAt('PROXIMAL', 'DISTAL', 'ACROSS FRACTURE').length && opnSayList(notAt('PROXIMAL', 'DISTAL', 'ACROSS FRACTURE'))].filter(Boolean);
        const scr = pdParts.length ? ` and fixed with ${opnJoin(pdParts)}` : '';
        if (ap.both && plates.length === 1) L.push(`Two ${impName}s were contoured as required and applied, ${ap.both}${scr}.`);
        else {
          const surface = (ap.bothSurfaces && ap.bothSurfaces[plateNo]) || ap.surface || imp.surface || 'appropriate';
          // "volar, proximal to the watershed line" → "volar surface, proximal to the watershed line"
          const [s1, ...more] = surface.split(', ');
          L.push(`A ${impName} was contoured as required and applied on the ${s1}${/surface|border/.test(s1) ? '' : ' surface'}${more.length ? `, ${more.join(', ')},` : ''}${scr}.`);
        }
        plateNo++;
        break;
      }
      case 'mipo': {
        const pdParts = [at('PROXIMAL').length && `${opnSayList(at('PROXIMAL'))} proximal to the fracture`, at('DISTAL').length && `${opnSayList(at('DISTAL'))} distal to the fracture`,
          notAt('PROXIMAL', 'DISTAL').length && opnSayList(notAt('PROXIMAL', 'DISTAL'))].filter(Boolean);
        L.push(`A ${impName} was slid through the submuscular tunnel along the ${imp.surface || ''} surface, position checked under C-arm${pdParts.length ? ` and fixed with ${opnJoin(pdParts)}` : ''}, using stab incisions for the screws.`);
        break;
      }
      case 'nail':
        L.push('Guide wire passed across the fracture site into the distal fragment after closed reduction and confirmed under C-arm. Sequential reaming done.');
        {
          const px = at('PROXIMAL');
          const ds = at('DISTAL');
          const other = notAt('PROXIMAL', 'DISTAL');
          L.push(`${impName} inserted over the guide wire and the fracture reduction maintained.`);
          L.push(px.length ? `${opnSayList(px)} ${opnCount(px) > 1 ? 'were' : 'was'} used for proximal locking through the jig.` : 'Proximal locking done through the jig.');
          L.push(ds.length ? `${opnSayList(ds)} ${opnCount(ds) > 1 ? 'were' : 'was'} used for distal locking by free-hand technique under C-arm.` : 'Distal locking done by free-hand technique under C-arm.');
          if (other.length) L.push(`${opnSayList(other)} also used.`);
        }
        L.push(`Nail position and ${imp.bone || 'bone'} length / rotation checked.`);
        break;
      case 'tens':
        L.push(`Entry points made with an awl through small incisions and ${impName} pre-bent and passed across the fracture site under C-arm guidance; ends cut and bent outside the bone.`);
        break;
      case 'pfn':
        L.push('Entry made at the tip of the greater trochanter with an awl under C-arm; guide wire passed into the femoral canal across the fracture.');
        {
          const neck = at('NECK');
          const rest = notAt('NECK');
          L.push(`Proximal femur opened with the entry reamer and the ${impName} inserted with the jig. Guide wires for the neck screws placed centre-inferior on AP and central on lateral view; ${neck.length ? opnSayList(neck) : (i.implant === 'pfna' ? 'helical blade' : 'lag screw and anti-rotation screw')} inserted after measurement.`);
          L.push(rest.length ? `${opnSayList(rest)} ${opnCount(rest) > 1 ? 'were' : 'was'} used for distal locking through the jig.` : 'Distal locking done through the jig.');
        }
        break;
      case 'dhs':
        L.push('Guide wire inserted at 135 degrees from the lateral cortex into the femoral head, centre-centre on AP and lateral views with tip-apex distance less than 25mm; length measured.');
        {
          const neck = at('NECK');
          const rest = notAt('NECK');
          L.push(`Triple reaming done and the ${neck.length ? opnSayList(neck) : 'lag screw'} inserted; ${impName} applied and fixed to the femoral shaft${rest.length ? ` with ${opnSayList(rest)}` : ''}. Compression screw applied.`);
        }
        break;
      case 'ccNeck':
        L.push(`Three guide wires passed parallel in an inverted triangle configuration along the calcar and posterior cortex under C-arm; ${screwText || '6.5MM CANNULATED CANCELLOUS SCREWS'} inserted after measurement with threads crossing the fracture.`);
        break;
      case 'screws':
        if (!ap.closed) reduce();
        L.push(`${(ap.targets && ap.targets[imps.indexOf(i)]) || 'Fracture'} fixed with ${screwText || impName} with compression across the fracture site.`);
        break;
      case 'tbw':
        reduce(openReduce.replace('reduction clamps / K-wires', 'a reduction clamp'));
        L.push(`${imp.label === 'Cannulated screws + tension band' ? 'Two cannulated screws inserted across the fracture and an 18G SS wire passed through them' : 'Two parallel K-wires passed across the fracture and an 18G SS wire passed deep to the K-wires'} in a figure-of-eight fashion and tightened, converting tensile into compressive forces. K-wire ends bent and buried.`);
        break;
      case 'kwire':
        L.push(`Fixed with ${screwText || 'K-wires'}; wires bent and cut outside the skin / buried as appropriate.`);
        break;
      case 'exfix': {
        const pp = at('PROXIMAL');
        const dd = at('DISTAL');
        const fr = at('FRAME');
        const rest = notAt('PROXIMAL', 'DISTAL', 'FRAME');
        if (!pp.length && !dd.length && !fr.length) {
          L.push(`Two pins inserted in each main fragment and the ${impName} assembled with clamps and rods after achieving reduction${screwText ? ` (${screwText})` : ''}.`);
          break;
        }
        const pins = [[pp, 'proximal'], [dd, 'distal']].filter(([g]) => g.length)
          .map(([g, w], i) => `${list(g)}${i ? '' : opnCount(g) === 1 ? ' was placed' : ' were placed'} in the ${w} fragment`);
        if (pins.length) L.push(`${pins.join(' and ')}${rest.length ? `, along with ${list(rest)}` : ''}.`);
        else if (rest.length) L.push(`${list(rest)} were placed.`);
        L.push(`The ${impName} was assembled${fr.length ? ` with ${list(fr)}` : ' with clamps and rods'} and all clamps were tightened after confirming the reduction.`);
        break;
      }
      case 'hemi':
        L.push('Femoral head removed with a corkscrew and its size measured. Neck osteotomy done 1-1.5cm above the lesser trochanter.');
        L.push(`Femoral canal prepared with box chisel and rasps, and ${impName}${size ? '' : ' of appropriate size'} inserted with appropriate anteversion; hip reduced and found stable through range of motion.`);
        L.push('Capsule and short external rotators repaired.');
        break;
      case 'excision':
        L.push('Fragments of the radial head removed and the neck smoothened at the level of the annular ligament; elbow and forearm rotation checked for stability.');
        break;
      case 'patellectomy':
        L.push('Comminuted pole fragments excised; patellar tendon reattached to the remaining patella through drill holes with non-absorbable sutures.');
        break;
      default:
        reduce();
        L.push(`Fixed with ${impName}${scr}.`);
    }
  });
  if (p.approach === 'humDistPost') L.push('Olecranon osteotomy reduced and fixed with tension band wiring.');
  L.push('Reduction and implant position confirmed under C-arm in AP and lateral views.');
  if (p.tourniquet === 'yes') L.push('Tourniquet released and haemostasis achieved.');
  L.push('Thorough wound wash given with normal saline. Haemostasis achieved.');
  if (p.drain === 'yes') L.push('Drain placed.');
  L.push(kinds.every((k) => k === 'exfix') || ap.closed ? 'Incisions closed and sterile dressing applied.' : 'Wound closed in layers with absorbable sutures and skin closed with ethilon / staples. Sterile dressing applied.');
  if (p.slab && p.slab !== 'NONE') L.push(`${U(p.slab).toLowerCase()} applied.`);
  const implantsAll = imps.flatMap((i) => (opnImp(i).k === 'screws' && opnScrewList(i).length ? opnScrewList(i) : [opnImpName(i), ...opnScrewList(i)]));
  return { name, lines: L, implants: implantsAll };
}

function opNoteText(raw) {
  const b = opnNormalize(raw);
  if (!b) return '';
  const U = (s) => String(s || '').toUpperCase();
  const parts = b.procs.map((p) => ({ p, r: opnProc(p) })).filter((x) => x.r);
  if (!parts.length) return '';
  const fx = String(raw.dx || '').trim() || parts.map(({ p, r }) => (p.cat && p.cat !== 'trauma' ? r.name : `FRACTURE ${opnSite(p).label} ${opnBoneLabel(p)} ${U(p.side)}`)).join(' + ');
  const multi = parts.length > 1;
  const positions = [...new Set(parts.map(({ p }) => U(p.position)).filter(Boolean))];
  // Only the operative procedure: diagnosis, procedure done and implants have their own boxes on the case page.
  void fx; void positions;
  const L = [];
  parts.forEach(({ p, r }, i) => {
    const pos = U(p.position);
    if (i === 0) {
      L.push([`Under ${U(b.anaes).toLowerCase()}, patient positioned ${pos.toLowerCase()}${/TABLE|BOLSTER/.test(pos) ? '' : ' on a radiolucent table'}.`,
        'Parts painted with povidone iodine and draped under strict aseptic precautions.',
        p.tourniquet === 'yes' ? 'Tourniquet applied and inflated after exsanguination.' : ''].filter(Boolean).join(' '));
    }
    if (multi) {
      L.push('');
      L.push(`PROCEDURE ${i + 1}:`);
      if (i > 0) {
        const prev = U(parts[i - 1].p.position);
        L.push([pos !== prev ? `Patient repositioned ${pos.toLowerCase()}; parts painted and draped again.` : 'Parts painted and draped for the next procedure.',
          p.tourniquet === 'yes' ? 'Tourniquet applied and inflated after exsanguination.' : ''].filter(Boolean).join(' '));
      }
    }
    r.lines.forEach((l) => L.push(l));
  });
  if (multi) L.push('');
  L.push(parts.every(({ p }) => p.cat === 'spine') ? 'Neurological status of both lower limbs checked post-operatively.' : 'Distal neurovascular status checked and found intact.');
  L.push('Patient shifted to the post-operative ward in stable condition.');
  return L.join('\n').toUpperCase();
}

const opProcedureName = (raw) => {
  const b = opnNormalize(raw);
  return (b?.procs || []).map(opnProc).filter(Boolean).map((r) => r.name.toUpperCase()).join(' + ');
};


// ---- Builder state and HTML (case page → Operative details)
// Guess region / bone / site / side from the diagnosis so the lists open in the right place.
const OPN_GUESS = [
  [/CLAVICLE/, 'upper', 'clavicle', (d) => (/LATERAL/.test(d) ? 'lat' : 'mid')],
  [/(PROXIMAL|NECK OF) HUMERUS|SURGICAL NECK/, 'upper', 'proxHumerus', () => 'neck'],
  [/SHAFT (OF )?HUMERUS|HUMERUS SHAFT/, 'upper', 'humShaft', () => 'mid'],
  [/INTERCONDYLAR HUMERUS|DISTAL HUMERUS/, 'upper', 'distHumerus', () => 'bicol'],
  [/SUPRACONDYLAR HUMERUS/, 'upper', 'distHumerus', () => 'supra'],
  [/LATERAL CONDYLE/, 'upper', 'distHumerus', () => 'latCond'],
  [/OLECRANON/, 'upper', 'olecranon', () => 'trans'],
  [/RADIAL HEAD|HEAD OF RADIUS/, 'upper', 'radHead', () => 'head'],
  [/BOTH BONE(S)? FOREARM|BBFA/, 'upper', 'forearm', () => 'both'],
  [/GALEAZZI/, 'upper', 'forearm', () => 'galeazzi'],
  [/MONTEGGIA/, 'upper', 'forearm', () => 'monteggia'],
  [/DISTAL (END )?(OF )?RADIUS|DISTAL RADIUS|COLLES|BARTON|SMITH/, 'upper', 'distRadius', (d) => (/BARTON|SMITH/.test(d) ? 'barton' : /INTRA/.test(d) ? 'intra' : 'extra')],
  [/METACARPAL/, 'upper', 'hand', () => 'mc'],
  [/PHALANX/, 'upper', 'hand', () => 'ph'],
  [/ACETABUL/, 'lower', 'pelvis', () => 'postWall'],
  [/SYMPHYSIS/, 'lower', 'pelvis', () => 'symph'],
  [/SUB\s*TROCHANTER/, 'lower', 'proxFemur', () => 'subtroch'],
  [/INTER\s*TROCHANTER|PER\s*TROCHANTER|\bIT\b/, 'lower', 'proxFemur', () => 'it'],
  [/NECK\s+OF\s+(THE\s+)?FEMUR|FEMORAL NECK|\bNOF\b|NECK FEMUR/, 'lower', 'proxFemur', () => 'nof'],
  [/SUPRACONDYLAR FEMUR|DISTAL FEMUR/, 'lower', 'distFemur', () => 'supra'],
  [/INTERCONDYLAR FEMUR/, 'lower', 'distFemur', () => 'inter'],
  [/SHAFT (OF )?FEMUR|FEMUR SHAFT/, 'lower', 'femShaft', () => 'mid'],
  [/PATELLA/, 'lower', 'patella', () => 'trans'],
  [/TIBIAL PLATEAU|PLATEAU/, 'lower', 'plateau', () => 'lat'],
  [/PILON/, 'lower', 'pilon', () => 'pilon'],
  [/SHAFT (OF )?TIBIA|TIBIA SHAFT|BOTH BONE(S)? LEG/, 'lower', 'tibShaft', () => 'mid'],
  [/TRIMALLEOLAR/, 'lower', 'ankle', () => 'trimal'],
  [/BIMALLEOLAR/, 'lower', 'ankle', () => 'bimal'],
  [/LATERAL MALLEOLUS/, 'lower', 'ankle', () => 'lat'],
  [/MEDIAL MALLEOLUS/, 'lower', 'ankle', () => 'med'],
  [/CALCANE/, 'lower', 'calcaneum', () => 'jd'],
];

// A new procedure: the next fracture named in the diagnosis that no procedure covers yet, with the
// side written next to it ("…FEMUR RIGHT WITH … ANKLE LEFT").
function opnNewProc(c, prev, used = []) {
  const d = String(c?.diagnosis || '').toUpperCase();
  const sideIn = (t) => (/\b(LEFT|LT)\b/.test(t) ? 'LEFT' : /\b(RIGHT|RT)\b/.test(t) ? 'RIGHT' : '');
  // A procedure named in the plan (TKR, ACL reconstruction…) comes first; then a fracture in the
  // diagnosis (trauma); then a condition in the diagnosis (PIVD, GCT…).
  const tplFrom = (t) => { const g = typeof opnTplGuess === 'function' ? opnTplGuess(t) : null; return g && !used.includes(g.tpl) ? g : null; };
  const asTpl = (g) => opnTplFill({ cat: g.cat, tpl: g.tpl, side: sideIn(d) || prev?.side || '', tourniquet: 'no', drain: 'no', slab: 'NONE', implants: [], f: {} });
  const fromPlan = tplFrom(c?.plan);
  if (fromPlan) return asTpl(fromPlan);
  const p = { cat: 'trauma', side: '', tourniquet: 'no', drain: 'no', slab: 'NONE', implants: [] };
  const hits = OPN_GUESS.map(([re, region, bone, siteOf]) => { const m = re.exec(d); return m && { at: m.index, region, bone, site: siteOf(d) }; })
    .filter(Boolean).sort((a, b) => a.at - b.at);
  const g = hits.find((h) => !used.includes(h.bone));
  if (g) {
    Object.assign(p, { region: g.region, bone: g.bone, site: g.site });
    const seg = d.slice(g.at).split(/\bWITH\b|\+|,|;|\bAND\b/)[0];
    p.side = sideIn(seg) || sideIn(d);
  } else {
    const fromDx = tplFrom(d);
    if (fromDx) return asTpl(fromDx);
    if (prev?.cat && prev.cat !== 'trauma') return { cat: prev.cat, tpl: '', side: prev.side || sideIn(d), tourniquet: 'no', drain: 'no', slab: 'NONE', implants: [], f: {} };
    p.region = prev?.region || '';
    p.side = prev?.side || sideIn(d);
  }
  return opnFill(p, {});
}

// The implants written in the OT list ("8,9,10 * 320-360MM IMIL TIBIA NAIL, 4.9MM LOCKING BOLTS") → builder implant keys.
const OPN_OT_WORDS = [
  [/\bPFNA\b|HELICAL/, 'pfna'], [/LONG\s*PFN/, 'longPfn'], [/\bPFN\b/, 'shortPfn'], [/RETRO(GRADE)?/, 'retroFemNail'],
  [/\bPHN\b|PROXIMAL HUMERUS NAIL/, 'phn'], [/HUMER\w*\s+(INTERLOCKING\s+)?NAIL|IMIL\s+HUMER/, 'humNail'],
  [/TIBIA\w*\s+(INTERLOCKING\s+)?NAIL|IMIL\s+TIBIA|\bILTN\b/, 'tibNail'], [/FEMU?R\w*\s+(INTERLOCKING\s+)?NAIL|IMIL\s+FEMUR|\bILFN\b|\bIMIL\b/, 'femNail'],
  [/\bTENS\b|ELASTIC NAIL/, 'tens'], [/RUSH/, 'rush'], [/\bDHS\b/, 'dhs'], [/\bDCS\b/, 'dcs'], [/PHILOS|PROXIMAL HUMERUS (LOCKING )?PLATE/, 'philos'],
  [/BROAD\s*LCP/, 'broadLcp'], [/BROAD\s*DCP/, 'broadDcp'], [/NARROW\s*LCP/, 'narrowLcp'], [/NARROW\s*DCP/, 'narrowDcp'],
  [/\bDFLP\b|DISTAL FEMU?R\w* (LOCKING )?PLATE/, 'dflp'], [/CONDYLAR BUTTRESS/, 'condButtress'], [/PROXIMAL TIBIA\w*|\bPTLP\b|\bLPTP\b|\bLPTLP\b/, 'ptlLcp'],
  [/MEDIAL DISTAL TIBIA|\bMDTP\b|\bMDTLP\b|\bMDT\b/, 'mdtLcp'], [/ANTEROLATERAL DISTAL TIBIA|\bALDTP\b/, 'aldtPlate'], [/MEDIAL BUTTRESS/, 'medButtress'],
  [/VOLAR|DISTAL RADIUS (LOCKING )?PLATE|\bDRLP\b/, 'volarLock'], [/\bT[\s-]?PLATE/, 'tPlate'], [/1\/3|ONE[\s-]?THIRD|TUBULAR/, 'oneThird'],
  [/FIBULA\w* (LOCKING )?PLATE/, 'fibLcp'], [/CALCAN\w* PLATE/, 'calcPlate'], [/HOOK PLATE/, 'hookPlate'], [/LATERAL CLAVICLE/, 'lateralClav'],
  [/CLAVICLE/, 'clavLcp'], [/OLECRANON (LOCKING )?PLATE/, 'olecLcp'], [/DISTAL HUMERUS/, 'dualDistHum'], [/RECON/, 'recon35'], [/MINI\s*PLATE|2\.0\s*MM|2\.4\s*MM\s*PLATE/, 'miniPlate'],
  [/3\.5\s*MM\s*LCP|LCP\s*3\.5|3\.5\s*LCP/, 'lcp35'], [/LC[\s-]?DCP/, 'lcdcp35'], [/3\.5\s*MM\s*DCP|\bDCP\b/, 'dcp35'], [/\bLCP\b/, 'narrowLcp'],
  [/\bTBW\b|TENSION BAND/, 'tbw'], [/HERBERT/, 'herbert'], [/CANNULATED|\bCC\s*SCREW|\bCCS\b/, 'ccScrews'], [/K[\s-]?WIRE/, 'kwires'],
  [/ILIZAROV/, 'ilizarov'], [/\bLRS\b|EX\s*-?FIX|EXTERNAL FIXATOR|\bJESS\b/, 'exfix'], [/BIPOLAR/, 'bipolar'], [/AUSTIN MOORE|\bAMP\b/, 'amp'], [/THOMPSON/, 'cemThompson'],
  [/SYNDESMO/, 'syndesmotic'],
];
function opnOtImplants(text) {
  const out = [];
  for (const part of String(text || '').toUpperCase().split(/[,;+\n]|\bAND\b|\bWITH\b/)) {
    const hit = OPN_OT_WORDS.find(([re]) => re.test(part));
    if (hit && !out.includes(hit[1])) out.push(hit[1]);
  }
  return out;
}

function opnDefaults(c) {
  const p = opnNewProc(c);
  // the implant planned in the OT list, if it is one the builder knows
  const ot = opnOtImplants(c.implants);
  const site = p.cat === 'trauma' ? opnSite(p) : null;
  if (site && ot.length && p.implants?.[0]) {
    const want = ot.find((k) => site.im.includes(k)) || ot.find((k) => OPN_IMPLANTS[k]?.k !== 'screws') || ot[0];
    if (want) p.implants[0].implant = want;
  }
  const anaes = p.cat === 'trauma' ? (p.region ? OPN_TRAUMA[p.region].anaes : '') : (opnTpl(p)?.anaes || '');
  return { v: 2, cat: p.cat, anaes, procs: [p] };
}

// Screws / wires an implant usually takes: nails proximal + distal bolts, PFN / DHS neck screws + distal.
// Offered as one-tap "+ …" buttons only — an implant starts with no screw rows (added when asked for).
const opnDefScrews = () => [];
function opnSugScrews(site, k) {
  const kind = OPN_IMPLANTS[k]?.k;
  const sc = site?.sc || [];
  const bolt = (sc.find((t) => /BOLT/.test(t)) || '4.9MM LOCKING BOLTS').replace('DISTAL ', '');
  if (kind === 'nail') return [{ type: bolt, n: '', len: '', at: 'PROXIMAL' }, { type: bolt, n: '', len: '', at: 'DISTAL' }];
  if (kind === 'pfn') return [{ type: k === 'pfna' ? 'HELICAL BLADE' : 'LAG SCREW', n: '1', len: '', at: 'NECK' }, ...(k === 'pfna' ? [] : [{ type: 'ANTI-ROTATION SCREW', n: '1', len: '', at: 'NECK' }]), { type: bolt, n: '', len: '', at: 'DISTAL' }];
  if (kind === 'dhs') return [{ type: 'LAG SCREW', n: '1', len: '', at: 'NECK' }, { type: '4.5MM CORTICAL SCREWS', n: '', len: '', at: 'SHAFT' }];
  return sc.map((t) => ({ type: t, n: '', len: '', at: '' }));
}
const opnNewImp = (site, k) => ({ implant: k || '', implantCustom: '', size: '', screws: opnDefScrews(site, k) });

// Fill whatever follows from what was just chosen in a procedure.
function opnFill(p, changed) {
  const site = opnSite(p);
  const big = changed.site || changed.bone || changed.region;
  if (site) {
    if (big || !site.ap.includes(p.approach)) p.approach = site.ap[0];
    if (big || !p.implants?.length) p.implants = [opnNewImp(site, site.im[0])];
  } else if (big) {
    p.approach = '';
    p.implants = [];
  }
  const ap = OPN_APPROACHES[p.approach];
  if (ap && (changed.approach || big || !p.position)) {
    p.position = ap.pos;
    p.tourniquet = ap.tq ? 'yes' : 'no';
  }
  return p;
}

// A change in the builder → the model. Returns true when something changed.
function opnApplyChange(B, t) {
  const d = t.dataset;
  if (d.ob) {
    B[d.ob] = t.value;
    return true;
  }
  const p = B.procs[+d.p];
  if (!p) return false;
  if (d.pf === 'cat') {
    // another section: start this procedure afresh (side kept)
    const side = p.side;
    Object.keys(p).forEach((k) => delete p[k]);
    Object.assign(p, t.value === 'trauma' || !t.value
      ? { cat: 'trauma', region: '', bone: '', site: '', side, tourniquet: 'no', drain: 'no', slab: 'NONE', implants: [] }
      : { cat: t.value, tpl: '', side, tourniquet: 'no', drain: 'no', slab: 'NONE', implants: [], f: {} });
    return true;
  }
  if (d.pf === 'tpl') {
    p.tpl = t.value;
    opnTplFill(p);
    if (!B.anaes && opnTpl(p)?.anaes) B.anaes = opnTpl(p).anaes;
    return true;
  }
  if (d.ff) {
    p.f = p.f || {};
    p.f[d.ff] = t.value;
    return true;
  }
  if (d.pf && p.cat && p.cat !== 'trauma') {
    p[d.pf] = t.value;
    return true;
  }
  if (d.pf) {
    const k = d.pf;
    p[k] = t.value;
    ({ region: ['bone', 'site'], bone: ['site'] }[k] || []).forEach((r) => { p[r] = ''; });
    if (k === 'region' && t.value && !B.anaes) B.anaes = OPN_TRAUMA[t.value].anaes;
    opnFill(p, { [k]: true });
    return true;
  }
  const imp = p.implants[+d.i];
  if (!imp) return false;
  if (d.if) {
    imp[d.if] = t.value;
    return true;
  }
  if (d.sf) {
    imp.screws[+d.s][d.sf] = t.value;
    return true;
  }
  return false;
}

// A button in the builder → the model.
function opnApplyClick(B, el, c) {
  const d = el.dataset;
  if (d.addProc !== undefined) { B.procs.push(opnNewProc(c, B.procs.at(-1), B.procs.map((x) => x.bone || x.tpl))); return true; }
  if (d.rmProc !== undefined) { B.procs.splice(+d.rmProc, 1); if (!B.procs.length) B.procs.push(opnNewProc(c)); return true; }
  const p = B.procs[+d.p];
  if (!p) return false;
  if (d.addImpCustom !== undefined) { p.implants.push({ implant: 'custom', implantCustom: '', size: '', screws: [] }); return true; }
  if (d.addImp !== undefined) {
    p.implants.push(p.cat && p.cat !== 'trauma' ? { implant: 'custom', implantCustom: '', size: '', screws: [] } : opnNewImp(opnSite(p), ''));
    return true;
  }
  if (d.rmImp !== undefined) { p.implants.splice(+d.i, 1); return true; }
  const imp = p.implants[+d.i];
  if (!imp) return false;
  if (d.addScrAt !== undefined) { imp.screws.push({ type: d.type || '', n: '', len: '', at: d.addScrAt, ...(p.cat === 'spine' ? { level: '', side: 'BILATERAL' } : {}) }); return true; }
  if (d.addScr !== undefined) { imp.screws.push({ type: p.cat === 'spine' ? 'PEDICLE SCREWS' : '', n: '', len: '', at: '', ...(p.cat === 'spine' ? { level: '', side: 'BILATERAL' } : {}) }); return true; }
  if (d.sugScr !== undefined) {
    const sg = opnSugScrews(opnSite(p), imp.implant)[+d.sugScr];
    if (sg) imp.screws.push({ ...sg });
    return true;
  }
  if (d.rmScr !== undefined) { imp.screws.splice(+d.s, 1); return true; }
  return false;
}

function opnHTML(raw, ctx = {}) {
  const B = opnNormalize(raw);
  const otImps = opnOtImplants(ctx.otImplants);
  const o = (list, sel) => '<option value="">—</option>' + list.map(([v, l]) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(l)}</option>`).join('');
  const pairs = (arr) => arr.map((x) => [x, x]);
  const top = `<div class="opn-grid">
      <label class="span2">Anaesthesia<select data-ob="anaes">${o(pairs(OPN_ANAES), B.anaes || '')}</select></label></div>`;
  // Screw / wire rows, the same for every section
  const screwRows = (imp, ia) => (imp.screws || []).map((s, si) => `<div class="opn-screw">
          <select ${ia} data-s="${si}" data-sf="type" aria-label="Screw / wire">${o([...pairs([...new Set([...OPN_SCREWS, ...(s.type && s.type !== 'custom' ? [s.type] : [])])]), ['custom', 'Custom…']], s.type || '')}</select>
          ${s.type === 'custom' ? `<input ${ia} data-s="${si}" data-sf="custom" value="${esc(s.custom || '')}" aria-label="Custom screw / wire">` : ''}
          <label class="opn-n">No.<input ${ia} data-s="${si}" data-sf="n" inputmode="numeric" value="${esc(s.n || '')}"></label>
          <label class="opn-len">Length (mm)<input ${ia} data-s="${si}" data-sf="len" inputmode="decimal" value="${esc(s.len || '')}" placeholder="e.g. 40 or 36, 38"></label>
          <label class="opn-at">Where<select ${ia} data-s="${si}" data-sf="at">${o(OPN_SCREW_AT, s.at || '')}</select></label>
          <button type="button" class="icon" ${ia} data-s="${si}" data-rm-scr title="Remove">✕</button></div>`).join('');
  // Spine: which screws, at which level(s), on which side, how many, size
  const spineRows = (imp, ia) => (imp.screws || []).map((s, si) => `<div class="opn-screw opn-spine">
          <select ${ia} data-s="${si}" data-sf="type" aria-label="Screws">${o([...pairs([...new Set([...OPN_SPINE_SCREWS, ...(s.type && s.type !== 'custom' ? [s.type] : [])])]), ['custom', 'Custom…']], s.type || '')}</select>
          ${s.type === 'custom' ? `<input ${ia} data-s="${si}" data-sf="custom" value="${esc(s.custom || '')}" aria-label="Custom screw">` : ''}
          <label class="opn-lvl">Level(s)<input ${ia} data-s="${si}" data-sf="level" value="${esc(s.level || '')}" placeholder="e.g. L3, L4, L5"></label>
          <label class="opn-side">Side<select ${ia} data-s="${si}" data-sf="side">${o(OPN_SPINE_SIDES, s.side || '')}</select></label>
          <label class="opn-n">No.<input ${ia} data-s="${si}" data-sf="n" inputmode="numeric" value="${esc(s.n || '')}"></label>
          <label class="opn-len">Size<input ${ia} data-s="${si}" data-sf="len" value="${esc(s.len || '')}" placeholder="e.g. 6.5 X 45"></label>
          <button type="button" class="icon" ${ia} data-s="${si}" data-rm-scr title="Remove">✕</button></div>`).join('');
  // Trauma: a menu per part of the implant (proximal / distal locking, screws each side of the fracture, lag screws…)
  const sectionRows = (imp, ia) => {
    const secs = opnScrewSections(imp);
    if (!secs) {
      return `<div class="opn-lab">Screws / wires for this implant</div>${screwRows(imp, ia)}<button type="button" class="btn small" ${ia} data-add-scr>+ Add screw / wire</button>`;
    }
    const ats = secs.map((x) => x.at);
    const row = (s, si, sec) => `<div class="opn-screw">
          <select ${ia} data-s="${si}" data-sf="type" aria-label="Type">${o([...pairs([...new Set([...sec.types, ...(s.type && s.type !== 'custom' ? [s.type] : [])])]), ['custom', 'Custom…']], s.type || '')}</select>
          ${s.type === 'custom' ? `<input ${ia} data-s="${si}" data-sf="custom" value="${esc(s.custom || '')}" aria-label="Custom">` : ''}
          ${sec.one ? '' : `<label class="opn-n">No.<input ${ia} data-s="${si}" data-sf="n" inputmode="numeric" value="${esc(s.n || '')}"></label>`}
          <label class="opn-len">${sec.one ? 'Length (mm)' : 'Length(s) (mm)'}<input ${ia} data-s="${si}" data-sf="len" inputmode="decimal" value="${esc(s.len || '')}" placeholder="${sec.one ? 'e.g. 90' : 'e.g. 34 or 34, 36'}"></label>
          <button type="button" class="icon" ${ia} data-s="${si}" data-rm-scr title="Remove">✕</button></div>`;
    const withIdx = (imp.screws || []).map((s, si) => ({ s, si }));
    const others = withIdx.filter(({ s }) => !ats.includes(s.at || ''));
    return secs.map((sec) => `<div class="opn-sec"><div class="opn-lab">${esc(sec.title)}</div>
        ${withIdx.filter(({ s }) => (s.at || '') === sec.at).map(({ s, si }) => row(s, si, sec)).join('')}
        <div class="opn-sec-add">${sec.add.map(([label, type]) => `<button type="button" class="btn small" ${ia} data-add-scr-at="${esc(sec.at)}" data-type="${esc(type)}">${esc(label)}</button>`).join('')}</div></div>`).join('')
      + (others.length ? `<div class="opn-sec"><div class="opn-lab">Other screws / wires</div>${others.map(({ s, si }) => row(s, si, { types: OPN_SCREWS })).join('')}</div>` : '');
  };
  const catSel = (p, pi) => `<label class="span2">Section<select data-p="${pi}" data-pf="cat">${o(OPN_CATEGORIES, p.cat || 'trauma')}</select></label>`;
  // A template procedure (spine, arthroplasty, arthroscopy, tumour, paediatrics, others)
  const tplHTML = (p, pi) => {
    const at = `data-p="${pi}"`;
    const t = opnTpl(p);
    const sel = (k, label, list, cls = '') => `<label class="${cls}">${label}<select ${at} data-pf="${k}">${o(list, p[k] || '')}</select></label>`;
    const items = Object.entries(OPN_TPL[p.cat]?.items || {}).map(([k, v]) => [k, v.label]);
    const field = (fd) => (fd.opts
      ? `<label class="span2">${esc(fd.label)}<select ${at} data-ff="${fd.k}">${fd.opts.map((v) => `<option${(p.f?.[fd.k] ?? fd.def) === v ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></label>`
      : `<label class="span2">${esc(fd.label)}<input ${at} data-ff="${fd.k}" value="${esc(p.f?.[fd.k] ?? '')}" placeholder="${esc(fd.ph || '')}"></label>`);
    const impHTML = (imp, ii) => {
      const ia = `${at} data-i="${ii}"`;
      return `<div class="opn-imp">
          <div class="opn-imp-head"><b>Implant ${ii + 1}</b><button type="button" class="link small" ${ia} data-rm-imp>Remove</button></div>
          <div class="opn-grid">
            <label class="span2">Implant<input ${ia} data-if="implantCustom" list="dl-opn-${pi}" value="${esc(imp.implantCustom || '')}" placeholder="Type or pick"></label>
            <label class="span2">Size / details<input ${ia} data-if="size" value="${esc(imp.size || '')}" placeholder="e.g. 52MM, SIZE 4, 8MM X 25MM"></label>
            ${p.cat === 'spine'
    ? `<div class="span2"><div class="opn-lab">Screws — level, side, number, size</div>${spineRows(imp, ia)}<button type="button" class="btn small" ${ia} data-add-scr>+ Add screws</button></div>`
    : `<div class="span2"><div class="opn-lab">Screws / wires / anchors</div>${screwRows(imp, ia)}<button type="button" class="btn small" ${ia} data-add-scr>+ Add screw / wire</button></div>`}
          </div></div>`;
    };
    return `<div class="opn-proc">
      <div class="opn-proc-head"><b>Procedure ${pi + 1}</b>${B.procs.length > 1 ? `<button type="button" class="link small" data-rm-proc="${pi}">Remove procedure</button>` : ''}</div>
      <div class="opn-grid">
        ${catSel(p, pi)}
        ${sel('tpl', 'Procedure', items, 'span2')}
        ${t ? `${t.side === false ? '' : sel('side', 'Side', pairs(['LEFT', 'RIGHT']))}
        ${sel('position', 'Position', pairs(OPN_POSITIONS))}
        ${sel('tourniquet', 'Tourniquet', [['yes', 'Used'], ['no', 'Not used']])}
        ${t.fields.map(field).join('')}` : ''}
      </div>
      ${t ? `${(p.implants || []).map(impHTML).join('')}
      <datalist id="dl-opn-${pi}">${(t.imps || []).map((v) => `<option value="${esc(v)}">`).join('')}</datalist>
      <button type="button" class="btn small" ${at} data-add-imp>+ Add implant</button>
      <div class="opn-grid opn-end">
        ${sel('drain', 'Drain', [['yes', 'Placed'], ['no', 'No drain']])}
        ${sel('slab', 'Slab / splint / cast', pairs(OPN_SLABS))}
      </div>` : ''}
    </div>`;
  };
  const procHTML = (p, pi) => {
    if (p.cat && p.cat !== 'trauma') return tplHTML(p, pi);
    const site = opnSite(p);
    const at = `data-p="${pi}"`;
    const sel = (k, label, list, cls = '') => `<label class="${cls}">${label}<select ${at} data-pf="${k}">${o(list, p[k] || '')}</select></label>`;
    const bones = Object.entries(opnBones(p.region)).map(([k, v]) => [k, v.label]);
    const sites = p.bone ? Object.entries(OPN_TRAUMA[p.region].bones[p.bone].sites).map(([k, v]) => [k, v.label]) : [];
    const aps = site ? site.ap.map((k) => [k, OPN_APPROACHES[k].label]) : [];
    // usual implants for this fracture first, then every other implant, then custom
    const impOptions = (cur) => {
      const opt = (k, l) => `<option value="${esc(k)}"${k === cur ? ' selected' : ''}>${esc(l)}</option>`;
      const fromOt = otImps.filter((k) => OPN_IMPLANTS[k]);
      const usual = (site ? site.im : []).filter((k) => !fromOt.includes(k));
      const rest = Object.keys(OPN_IMPLANTS).filter((k) => !usual.includes(k) && !fromOt.includes(k));
      return '<option value="">—</option>'
        + (fromOt.length ? `<optgroup label="From the OT list">${fromOt.map((k) => opt(k, OPN_IMPLANTS[k].label)).join('')}</optgroup>` : '')
        + (usual.length ? `<optgroup label="Usual for this fracture">${usual.map((k) => opt(k, OPN_IMPLANTS[k].label)).join('')}</optgroup>` : '')
        + `<optgroup label="Other implants">${rest.map((k) => opt(k, OPN_IMPLANTS[k].label)).join('')}</optgroup>`
        + `<optgroup label="Not in the list">${opt('custom', 'Custom implant…')}</optgroup>`;
    };
    const impHTML = (imp, ii) => {
      const ia = `${at} data-i="${ii}"`;
      return `<div class="opn-imp">
          <div class="opn-imp-head"><b>Implant ${ii + 1}</b>${p.implants.length > 1 ? `<button type="button" class="link small" ${ia} data-rm-imp>Remove implant</button>` : ''}</div>
          <div class="opn-grid">
            <label class="span2">Implant<select ${ia} data-if="implant">${impOptions(imp.implant || '')}</select></label>
            ${imp.implant === 'custom' ? `<label class="span2">Custom implant<input ${ia} data-if="implantCustom" value="${esc(imp.implantCustom || '')}" placeholder="Name of the implant"></label>` : ''}
            <label class="span2">Size / details (e.g. 8 HOLED, 9 X 250MM)<input ${ia} data-if="size" value="${esc(imp.size || '')}"></label>
            <div class="span2">${sectionRows(imp, ia)}</div>
          </div></div>`;
    };
    return `<div class="opn-proc">
      <div class="opn-proc-head"><b>Procedure ${pi + 1}</b>${B.procs.length > 1 ? `<button type="button" class="link small" data-rm-proc="${pi}">Remove procedure</button>` : ''}</div>
      <div class="opn-grid">
        ${catSel(p, pi)}
        ${sel('region', 'Region', Object.entries(OPN_TRAUMA).map(([k, v]) => [k, v.label]))}
        ${sel('bone', 'Bone', bones)}
        ${sel('site', 'Fracture site', sites)}
        ${sel('side', 'Side', pairs(['LEFT', 'RIGHT']))}
        ${sel('position', 'Position', pairs(OPN_POSITIONS))}
        ${sel('tourniquet', 'Tourniquet', [['yes', 'Used'], ['no', 'Not used']])}
        ${sel('approach', 'Approach', aps, 'span2')}
      </div>
      ${(p.implants || []).map(impHTML).join('')}
      <div class="opn-sec-add"><button type="button" class="btn small" ${at} data-add-imp>+ Add implant</button><button type="button" class="btn small" ${at} data-add-imp-custom>+ Custom implant</button></div>
      <div class="opn-grid opn-end">
        ${sel('drain', 'Drain', [['yes', 'Placed'], ['no', 'No drain']])}
        ${sel('slab', 'Slab / splint', pairs(OPN_SLABS))}
      </div>
    </div>`;
  };
  return top + B.procs.map(procHTML).join('') + '<button type="button" class="btn small primary opn-add-proc" data-add-proc>+ Add procedure</button>';
}

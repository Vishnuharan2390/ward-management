// Operative note builder — trauma. Pick the fracture, side, anaesthesia, position, approach and
// implants; the rest (approach steps, structures incised / retracted / protected, reduction,
// fixation, C-arm check, closure) is written from the library below. The note is a draft: the
// surgeon reads and edits it before saving.

const OPN_CATEGORIES = [
  ['trauma', 'Trauma'], ['spine', 'Spine'], ['arthroplasty', 'Arthroplasty'], ['arthroscopy', 'Arthroscopy'], ['tumour', 'Tumour'], ['paediatrics', 'Paediatrics'],
];
const OPN_READY = ['trauma'];

const OPN_ANAES = ['SPINAL ANAESTHESIA', 'COMBINED SPINAL EPIDURAL ANAESTHESIA', 'GENERAL ANAESTHESIA', 'SUPRACLAVICULAR BRACHIAL PLEXUS BLOCK', 'INFRACLAVICULAR BRACHIAL PLEXUS BLOCK', 'AXILLARY BRACHIAL PLEXUS BLOCK', 'INTERSCALENE BLOCK', 'REGIONAL BLOCK WITH GENERAL ANAESTHESIA', 'LOCAL ANAESTHESIA'];
const OPN_POSITIONS = ['SUPINE', 'SUPINE ON FRACTURE TABLE', 'SUPINE WITH ARM ON HAND TABLE', 'SUPINE WITH SANDBAG UNDER IPSILATERAL HIP', 'SUPINE WITH KNEE FLEXED OVER BOLSTER', 'BEACH CHAIR', 'LATERAL', 'LATERAL WITH ARM OVER BOLSTER', 'PRONE', 'PRONE WITH ARM OVER BOLSTER'];
const OPN_SCREWS = ['3.5MM CORTICAL SCREWS', '4.5MM CORTICAL SCREWS', '2.7MM CORTICAL SCREWS', '3.5MM LOCKING SCREWS', '5MM LOCKING SCREWS', '2.4MM LOCKING SCREWS', '4MM CANCELLOUS SCREWS', '6.5MM CANCELLOUS SCREWS (PARTIALLY THREADED)', '4MM CANNULATED CANCELLOUS SCREWS', '6.5MM CANNULATED CANCELLOUS SCREWS', '7MM CANNULATED CANCELLOUS SCREWS', '4.9MM DISTAL LOCKING BOLTS', '3.9MM LOCKING BOLTS', 'HERBERT SCREWS', 'K-WIRES', '18G SS WIRE'];

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
  forearmBoth: { label: 'Volar (Henry) approach to radius + subcutaneous approach to ulna', pos: 'SUPINE WITH ARM ON HAND TABLE', tq: true, both: 'one on the volar surface of the radius and one on the subcutaneous border of the ulna', steps: [
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
  ankleBoth: { label: 'Lateral approach to fibula + medial approach to medial malleolus', pos: 'SUPINE', tq: true, steps: [
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
      bimal: S('Bimalleolar', ['ankleBoth'], ['oneThird', 'fibLcp'], ['3.5MM CORTICAL SCREWS', '4MM CANNULATED CANCELLOUS SCREWS']),
      trimal: S('Trimalleolar', ['ankleBoth'], ['oneThird', 'fibLcp'], ['3.5MM CORTICAL SCREWS', '4MM CANNULATED CANCELLOUS SCREWS']),
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

// ---- The note
function opNoteText(b) {
  const U = (s) => String(s || '').toUpperCase();
  const side = U(b.side);
  const site = opnSite(b);
  const ap = OPN_APPROACHES[b.approach];
  const imp = b.implant === 'custom' ? { label: b.implantCustom || 'IMPLANT', k: b.customKind || 'plate' } : OPN_IMPLANTS[b.implant];
  if (!site || !ap || !imp) return '';
  const boneLabel = opnBoneLabel(b);
  const boneName = boneLabel.replace(/ & /g, ' AND ').replace(/\s*shaft$/i, '').replace(/^Shaft of /i, '');
  const fx = String(b.dx || '').trim() || `FRACTURE ${site.label} ${boneLabel} ${side}`;
  const size = String(b.size || '').trim();
  const impName = [size, imp.label].filter(Boolean).join(' ');
  const screws = (b.screws || []).filter((s) => s.type && s.type !== '').map((s) => `${s.n ? s.n + ' X ' : ''}${s.type === 'custom' ? s.custom : s.type}`.trim()).filter(Boolean);
  const screwText = screws.length ? screws.join(', ') : '';
  const closed = !!ap.closed;

  // procedure name
  let procedure;
  if (imp.k === 'hemi') procedure = `${imp.label.replace(/\s*(hemiarthroplasty\s*)?prosthesis$/i, '')} HEMIARTHROPLASTY ${side} HIP${size ? ` (${size})` : ''}`;
  else if (imp.k === 'exfix') procedure = `${impName} APPLICATION ${side} ${boneName}`;
  else if (imp.k === 'excision') procedure = `RADIAL HEAD EXCISION ${side}`;
  else if (imp.k === 'patellectomy') procedure = `PARTIAL PATELLECTOMY WITH TENDON REPAIR ${side}`;
  else procedure = `${closed ? 'CLOSED' : 'OPEN'} REDUCTION AND INTERNAL FIXATION WITH ${impName} ${side} ${boneName}`;

  const L = [];
  L.push(`DIAGNOSIS: ${U(fx)}`.replace(/\s+/g, ' '));
  L.push(`PROCEDURE: ${U(procedure)}`.replace(/\s+/g, ' '));
  L.push(`ANAESTHESIA: ${U(b.anaes)}`);
  L.push(`POSITION: ${U(b.position)}`);
  L.push(`IMPLANTS: ${[impName, ...screws].join('; ')}`);
  L.push('');
  const pre = [`Under ${U(b.anaes).toLowerCase()}, patient positioned ${U(b.position).toLowerCase()}${/TABLE|BOLSTER/.test(U(b.position)) ? '' : ' on a radiolucent table'}.`,
    'Parts painted with povidone iodine and draped under strict aseptic precautions.',
    b.tourniquet === 'yes' ? 'Tourniquet applied and inflated after exsanguination.' : ''].filter(Boolean).join(' ');
  L.push(pre);
  if (!ap.closed) L.push(`${ap.label}:`);
  ap.steps.forEach((s) => L.push(s));

  // reduction + fixation
  const scr = screwText ? ` and fixed with ${screwText}` : '';
  const openReduce = 'Fracture haematoma evacuated and the fracture ends cleaned of interposed soft tissue and freshened. Fracture reduced anatomically under direct vision and held temporarily with reduction clamps / K-wires.';
  switch (imp.k) {
    case 'plate':
      L.push(openReduce);
      if (ap.both) L.push(`Two ${impName}s were contoured as required and applied, ${ap.both}${scr}.`);
      else L.push(`A ${impName} was contoured as required and applied on the ${ap.surface || imp.surface || 'appropriate'} surface${scr}.`);
      break;
    case 'mipo':
      L.push(`A ${impName} was slid through the submuscular tunnel along the ${imp.surface || ''} surface, position checked under C-arm${scr}, using stab incisions for the screws.`);
      break;
    case 'nail': {
      const bone = imp.bone || 'bone';
      L.push(`Guide wire passed across the fracture site into the distal fragment after closed reduction and confirmed under C-arm. Sequential reaming done.`);
      L.push(`${impName} inserted over the guide wire and the fracture reduction maintained. Proximal locking done using the jig and distal locking done by free-hand technique under C-arm${screwText ? `, using ${screwText}` : ''}.`);
      L.push(`Nail position and ${bone} length / rotation checked.`);
      break;
    }
    case 'tens':
      L.push(`Entry points made with an awl through small incisions and ${impName} pre-bent and passed across the fracture site under C-arm guidance; ends cut and bent outside the bone.`);
      break;
    case 'pfn':
      L.push('Entry made at the tip of the greater trochanter with an awl under C-arm; guide wire passed into the femoral canal across the fracture.');
      L.push(`Proximal femur opened with the entry reamer and the ${impName} inserted with the jig. Guide wires for the neck screws placed centre-inferior on AP and central on lateral view; lag screw and anti-rotation screw inserted after measurement.`);
      L.push(`Distal locking done${screwText ? ` with ${screwText}` : ''} through the jig.`);
      break;
    case 'dhs':
      L.push('Guide wire inserted at 135 degrees from the lateral cortex into the femoral head, centre-centre on AP and lateral views with tip-apex distance less than 25mm; length measured.');
      L.push(`Triple reaming done and the lag screw inserted; ${impName} applied and fixed to the femoral shaft${screwText ? ` with ${screwText}` : ''}. Compression screw applied.`);
      break;
    case 'ccNeck':
      L.push(`Three guide wires passed parallel in an inverted triangle configuration along the calcar and posterior cortex under C-arm; ${screwText || '6.5MM CANNULATED CANCELLOUS SCREWS'} inserted after measurement with threads crossing the fracture.`);
      break;
    case 'screws':
      if (!ap.closed) L.push(openReduce);
      L.push(`Fracture fixed with ${screwText || impName} with compression across the fracture site.`);
      break;
    case 'tbw':
      L.push(openReduce.replace('reduction clamps / K-wires', 'a reduction clamp'));
      L.push(`${imp.label === 'Cannulated screws + tension band' ? 'Two cannulated screws inserted across the fracture and an 18G SS wire passed through them' : 'Two parallel K-wires passed across the fracture and an 18G SS wire passed deep to the K-wires'} in a figure-of-eight fashion and tightened, converting tensile into compressive forces. K-wire ends bent and buried.`);
      break;
    case 'kwire':
      L.push(`Fracture fixed with ${screwText || 'K-wires'}; wires bent and cut outside the skin / buried as appropriate.`);
      break;
    case 'exfix':
      L.push(`Two pins inserted in each main fragment and the ${impName} assembled with clamps and rods after achieving reduction${screwText ? ` (${screwText})` : ''}.`);
      break;
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
      L.push(openReduce);
      L.push(`Fixed with ${impName}${scr}.`);
  }
  if (b.approach === 'humDistPost') L.push('Olecranon osteotomy reduced and fixed with tension band wiring.');
  L.push('Reduction and implant position confirmed under C-arm in AP and lateral views.');
  if (b.tourniquet === 'yes') L.push('Tourniquet released and haemostasis achieved.');
  L.push('Thorough wound wash given with normal saline. Haemostasis achieved.');
  if (b.drain === 'yes') L.push('Drain placed.');
  L.push(imp.k === 'exfix' || ap.closed ? 'Incisions closed and sterile dressing applied.' : 'Wound closed in layers with absorbable sutures and skin closed with ethilon / staples. Sterile dressing applied.');
  if (b.slab && b.slab !== 'NONE') L.push(`${U(b.slab).toLowerCase()} applied.`);
  L.push('Distal neurovascular status checked and found intact.');
  L.push('Patient shifted to the post-operative ward in stable condition.');
  return L.join('\n').toUpperCase();
}

const opProcedureName = (b) => (opNoteText(b).split('\n').find((l) => l.startsWith('PROCEDURE:')) || '').replace('PROCEDURE: ', '');


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

function opnDefaults(c) {
  const d = String(c.diagnosis || '').toUpperCase();
  const b = { cat: 'trauma', side: /\b(LEFT|LT)\b/.test(d) ? 'LEFT' : /\b(RIGHT|RT)\b/.test(d) ? 'RIGHT' : '', tourniquet: 'no', drain: 'no', slab: 'NONE', screws: [] };
  const g = OPN_GUESS.find(([re]) => re.test(d));
  if (g) { b.region = g[1]; b.bone = g[2]; b.site = g[3](d); }
  return opnFill(b, {});
}

// Fill whatever follows from what was just chosen (only where it isn't set yet).
function opnFill(b, changed) {
  const site = opnSite(b);
  if (b.region && (changed.region || !b.anaes)) b.anaes = OPN_TRAUMA[b.region].anaes;
  if (site) {
    if (changed.site || changed.bone || changed.region || !site.ap.includes(b.approach)) b.approach = site.ap[0];
    if (changed.site || changed.bone || changed.region || !(site.im.includes(b.implant) || b.implant === 'custom')) b.implant = site.im[0];
    if (changed.site || changed.bone || changed.region || !b.screws?.length) b.screws = site.sc.map((t) => ({ type: t, n: '' }));
  }
  const ap = OPN_APPROACHES[b.approach];
  if (ap && (changed.approach || changed.site || changed.bone || changed.region || !b.position)) {
    b.position = ap.pos;
    b.tourniquet = ap.tq ? 'yes' : 'no';
  }
  return b;
}

function opnHTML(b) {
  const o = (list, sel, blank = true) => (blank ? '<option value="">—</option>' : '') + list.map(([v, l]) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(l)}</option>`).join('');
  const pairs = (arr) => arr.map((x) => [x, x]);
  const sel = (key, label, list, cls = '') => `<label class="${cls}">${label}<select data-ob="${key}">${o(list, b[key] || '')}</select></label>`;
  if (b.cat && !OPN_READY.includes(b.cat)) {
    return `<div class="opn-grid">${sel('cat', 'Category', OPN_CATEGORIES)}<p class="muted small span2">Only trauma is ready for now — the others are coming.</p></div>`;
  }
  const site = opnSite(b);
  const bones = Object.entries(opnBones(b.region)).map(([k, v]) => [k, v.label]);
  const sites = b.bone ? Object.entries(OPN_TRAUMA[b.region].bones[b.bone].sites).map(([k, v]) => [k, v.label]) : [];
  const aps = site ? site.ap.map((k) => [k, OPN_APPROACHES[k].label]) : [];
  const ims = site ? [...site.im.map((k) => [k, OPN_IMPLANTS[k].label]), ['custom', 'Custom…']] : [];
  const screwRows = (b.screws || []).map((s, i) => `<div class="opn-screw">
      <select data-obs="${i}" data-f="type" aria-label="Screw type">${o([...pairs(OPN_SCREWS), ['custom', 'Custom…']], s.type || '')}</select>
      ${s.type === 'custom' ? `<input data-obs="${i}" data-f="custom" value="${esc(s.custom || '')}" aria-label="Custom screw / wire">` : ''}
      <label class="opn-n">No.<input data-obs="${i}" data-f="n" inputmode="numeric" value="${esc(s.n || '')}"></label>
      <button type="button" class="icon" data-obs-rm="${i}" title="Remove">✕</button></div>`).join('');
  return `<div class="opn-grid">
      ${sel('cat', 'Category', OPN_CATEGORIES)}
      ${sel('region', 'Region', Object.entries(OPN_TRAUMA).map(([k, v]) => [k, v.label]))}
      ${sel('bone', 'Bone', bones)}
      ${sel('site', 'Fracture site', sites)}
      ${sel('side', 'Side', pairs(['LEFT', 'RIGHT']))}
      ${sel('anaes', 'Anaesthesia', pairs(OPN_ANAES))}
      ${sel('position', 'Position', pairs(OPN_POSITIONS))}
      ${sel('tourniquet', 'Tourniquet', [['yes', 'Used'], ['no', 'Not used']])}
      ${sel('approach', 'Approach', aps, 'span2')}
      ${sel('implant', 'Implant', ims, 'span2')}
      ${b.implant === 'custom' ? `<label class="span2">Custom implant<input data-ob="implantCustom" value="${esc(b.implantCustom || '')}"></label>` : ''}
      <label class="span2">Implant size / details (e.g. 8 HOLED, 9 X 250MM)<input data-ob="size" value="${esc(b.size || '')}"></label>
      <div class="span2"><div class="opn-lab">Screws / wires</div>${screwRows}<button type="button" class="btn small" data-obs-add>+ Add screw / wire</button></div>
      ${sel('drain', 'Drain', [['yes', 'Placed'], ['no', 'No drain']])}
      ${sel('slab', 'Slab / splint', pairs(OPN_SLABS))}
    </div>`;
}

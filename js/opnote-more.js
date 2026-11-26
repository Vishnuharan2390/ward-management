// Operative note templates for every section other than trauma: spine, arthroplasty, arthroscopy,
// tumour, paediatrics and others. Each procedure has a few choices (level, graft, prosthesis…) and
// writes the standard steps around them; implants and screws (number, length, where) use the same
// rows as trauma. The note is a draft: the surgeon reads and edits it before saving.

// Field helpers: sel(key, label, options, default) / txt(key, label, placeholder)
const opnSel = (k, label, opts, def) => ({ k, label, opts, def: def ?? opts[0] });
const opnTxt = (k, label, ph = '') => ({ k, label, ph, def: '' });
const YESNO = ['NO', 'YES'];

const OPN_TPL = {
  // ------------------------------------------------------------------ SPINE
  spine: { label: 'Spine', items: {
    posStab: {
      label: 'Posterior pedicle screw stabilisation (± decompression, fusion)', pos: 'PRONE ON BOLSTERS', tq: false, anaes: 'GENERAL ANAESTHESIA', side: false,
      fields: [opnTxt('level', 'Levels (e.g. L3-L5)', 'L3-L5'), opnSel('decomp', 'Decompression', ['NONE', 'LAMINECTOMY', 'HEMILAMINECTOMY', 'LAMINECTOMY WITH FORAMINOTOMY']),
        opnSel('fusion', 'Fusion', ['POSTEROLATERAL FUSION WITH BONE GRAFT', 'TLIF WITH CAGE AND BONE GRAFT', 'NONE']), opnSel('graft', 'Graft', ['LOCAL BONE GRAFT', 'ILIAC CREST BONE GRAFT', 'LOCAL + ILIAC CREST BONE GRAFT']),
        opnSel('biopsy', 'Tissue sent for HPE / culture / GeneXpert', YESNO)],
      imps: ['PEDICLE SCREW AND ROD SYSTEM', '5.5MM TITANIUM RODS', 'TLIF CAGE'],
      defImps: [{ name: 'PEDICLE SCREW AND ROD SYSTEM', screws: [] }],
      name: (f) => `POSTERIOR ${f.decomp !== 'NONE' ? `${f.decomp} AND ` : ''}PEDICLE SCREW FIXATION ${f.level}${f.fusion !== 'NONE' ? ` WITH ${f.fusion}` : ''}`,
      steps: (f, x) => [
        `Level ${f.level} confirmed under C-arm. Midline posterior incision made centred over the levels.`,
        'Skin and subcutaneous tissue incised; thoracolumbar fascia incised and the paraspinal muscles stripped subperiosteally from the spinous processes and laminae out to the facet joints and transverse processes. Self-retaining retractors placed.',
        `Pedicle entry points made at the junction of the transverse process and the lateral facet; pedicles prepared with awl and probe and checked with a ball-tipped feeler for breach. ${x.screws ? `${x.screws} inserted` : 'Pedicle screws inserted'} and position confirmed under C-arm in AP and lateral views.`,
        ...(f.decomp !== 'NONE' ? [`${f.decomp[0] + f.decomp.slice(1).toLowerCase()} done with Kerrison rongeurs; ligamentum flavum excised and the dura and nerve roots decompressed and found free.`] : []),
        ...(f.biopsy === 'YES' ? ['Granulation tissue / pus curetted and sent for HPE, culture and GeneXpert.'] : []),
        ...(/TLIF/.test(f.fusion) ? ['Facetectomy done on the more symptomatic side, the exiting and traversing roots protected; discectomy and end-plate preparation done and an interbody cage packed with bone graft inserted.'] : []),
        ...(f.fusion !== 'NONE' ? [`Facets and transverse processes decorticated and ${f.graft.toLowerCase()} placed in the posterolateral gutters.`] : []),
        'Rods contoured, placed and secured with locking caps; compression / distraction applied as required and final tightening done.',
      ],
    },
    discectomy: {
      label: 'Lumbar discectomy', pos: 'PRONE ON BOLSTERS', tq: false, anaes: 'GENERAL ANAESTHESIA',
      fields: [opnTxt('level', 'Level (e.g. L4-L5)', 'L4-L5'), opnSel('way', 'Approach', ['FENESTRATION', 'HEMILAMINECTOMY', 'MICRODISCECTOMY'])],
      name: (f, x) => `${f.level} DISCECTOMY BY ${f.way} ${x.side}`,
      steps: (f, x) => [
        `Level ${f.level} confirmed under C-arm. Midline incision made over the level.`,
        `Paraspinal muscles stripped subperiosteally on the ${x.side.toLowerCase() || 'symptomatic'} side and retracted.`,
        `${f.way === 'HEMILAMINECTOMY' ? 'Hemilaminectomy' : 'Fenestration'} done; ligamentum flavum excised and the nerve root identified and gently retracted medially.`,
        'Prolapsed disc identified; annulotomy done and the disc material removed with pituitary rongeurs. Root found free and mobile at the end.',
      ],
    },
    laminectomy: {
      label: 'Decompressive laminectomy', pos: 'PRONE ON BOLSTERS', tq: false, anaes: 'GENERAL ANAESTHESIA', side: false,
      fields: [opnTxt('level', 'Levels (e.g. L3-L5)', 'L3-L5'), opnSel('foram', 'Foraminotomy', YESNO)],
      name: (f) => `DECOMPRESSIVE LAMINECTOMY ${f.level}${f.foram === 'YES' ? ' WITH FORAMINOTOMY' : ''}`,
      steps: (f) => [
        `Levels ${f.level} confirmed under C-arm. Midline posterior incision made and paraspinal muscles stripped subperiosteally on both sides.`,
        'Spinous processes and laminae removed with bone nibbler and Kerrison rongeurs; hypertrophied ligamentum flavum excised.',
        `Dura and nerve roots decompressed${f.foram === 'YES' ? ' and the foramina widened' : ''}; roots found free at the end.`,
      ],
    },
    acdf: {
      label: 'Anterior cervical discectomy and fusion (ACDF)', pos: 'SUPINE WITH NECK EXTENDED', tq: false, anaes: 'GENERAL ANAESTHESIA', side: false,
      fields: [opnTxt('level', 'Level (e.g. C5-C6)', 'C5-C6'), opnSel('plate', 'Anterior plate', ['YES', 'NO'])],
      imps: ['PEEK CERVICAL CAGE', 'ANTERIOR CERVICAL PLATE'],
      defImps: [{ name: 'PEEK CERVICAL CAGE', screws: [] }],
      name: (f) => `ANTERIOR CERVICAL DISCECTOMY AND FUSION ${f.level}${f.plate === 'YES' ? ' WITH PLATING' : ''}`,
      steps: (f, x) => [
        'Transverse incision made in a skin crease on the right side of the neck at the level.',
        'Platysma divided; plane developed between the sternocleidomastoid / carotid sheath laterally and the trachea / oesophagus medially. Prevertebral fascia divided.',
        `Level ${f.level} confirmed under C-arm. Longus colli elevated and retractors placed; Caspar distraction pins applied.`,
        'Discectomy done; posterior longitudinal ligament and osteophytes removed and the cord and roots decompressed. End-plates prepared.',
        `${x.imps || 'Cage'} packed with bone graft and inserted${f.plate === 'YES' ? '; anterior cervical plate applied and fixed with screws' : ''}. Position confirmed under C-arm.`,
      ],
      close: 'Wound closed in layers over a drain; skin closed with subcuticular sutures. Sterile dressing and cervical collar applied.',
    },
  } },

  // ------------------------------------------------------------------ ARTHROPLASTY
  arthroplasty: { label: 'Arthroplasty', items: {
    thr: {
      label: 'Total hip arthroplasty', pos: 'LATERAL DECUBITUS', tq: false, anaes: 'COMBINED SPINAL EPIDURAL ANAESTHESIA',
      fields: [opnSel('type', 'Type', ['UNCEMENTED', 'CEMENTED', 'HYBRID']), opnSel('ap', 'Approach', ['POSTERIOR (SOUTHERN)', 'DIRECT LATERAL (HARDINGE)'])],
      imps: ['ACETABULAR CUP', 'POLYETHYLENE LINER', 'FEMORAL HEAD', 'FEMORAL STEM', 'ACETABULAR SCREWS'],
      defImps: [{ name: 'ACETABULAR CUP' }, { name: 'POLYETHYLENE LINER' }, { name: 'FEMORAL HEAD' }, { name: 'FEMORAL STEM' }],
      name: (f, x) => `${f.type} TOTAL HIP ARTHROPLASTY ${x.side}`,
      steps: (f, x) => [
        ...(/POSTERIOR/.test(f.ap)
          ? ['Posterior (Southern) approach: curved incision centred on the greater trochanter; fascia lata and gluteus maximus split in line.', 'Short external rotators and piriformis tagged and released from the trochanter, protecting the sciatic nerve; capsule opened.']
          : ['Direct lateral (Hardinge) approach: lateral incision centred on the greater trochanter; fascia lata split.', 'Anterior part of gluteus medius and vastus lateralis elevated in continuity off the trochanter; capsule opened.']),
        'Hip dislocated; neck osteotomy done at the planned level and the femoral head removed.',
        `Acetabulum exposed, labrum and osteophytes excised and sequentially reamed to bleeding subchondral bone. ${f.type === 'CEMENTED' ? 'Cemented acetabular cup inserted with pressurised cement' : 'Press-fit acetabular cup impacted'} in 40-45 degrees inclination and 15-20 degrees anteversion${x.has('SCREW') ? ', supplemented with acetabular screws' : ''}; liner inserted.`,
        `Femoral canal opened, broached sequentially and trial reduction done to check leg length, offset and stability. ${f.type === 'UNCEMENTED' ? 'Uncemented femoral stem impacted' : 'Femoral stem cemented with third-generation cementing technique'} and femoral head applied.`,
        'Hip reduced and found stable through a full range of motion; leg lengths checked.',
        /POSTERIOR/.test(f.ap) ? 'Capsule and short external rotators repaired through trochanteric drill holes.' : 'Abductors repaired back to the trochanter.',
      ],
    },
    tkr: {
      label: 'Total knee arthroplasty', pos: 'SUPINE', tq: true, anaes: 'COMBINED SPINAL EPIDURAL ANAESTHESIA',
      fields: [opnSel('type', 'Design', ['CEMENTED POSTERIOR STABILISED', 'CEMENTED CRUCIATE RETAINING']), opnSel('pat', 'Patella', ['NOT RESURFACED', 'RESURFACED'])],
      imps: ['FEMORAL COMPONENT', 'TIBIAL TRAY', 'POLYETHYLENE INSERT', 'PATELLAR BUTTON', 'BONE CEMENT'],
      defImps: [{ name: 'FEMORAL COMPONENT' }, { name: 'TIBIAL TRAY' }, { name: 'POLYETHYLENE INSERT' }],
      name: (f, x) => `${f.type} TOTAL KNEE ARTHROPLASTY ${x.side}${f.pat === 'RESURFACED' ? ' WITH PATELLAR RESURFACING' : ''}`,
      steps: (f) => [
        'Midline skin incision; medial parapatellar arthrotomy done and the patella everted / subluxated laterally.',
        `Osteophytes removed; menisci${/STABILISED/.test(f.type) ? ', ACL and PCL' : ' and ACL'} excised. Medial soft-tissue release done as required for balancing.`,
        'Distal femoral cut made with the intramedullary guide in 5-7 degrees valgus; anterior, posterior and chamfer cuts made with the sizing block in correct rotation.',
        'Proximal tibial cut made perpendicular to the mechanical axis with the extramedullary guide.',
        `Flexion and extension gaps checked and balanced with spacer blocks; trial components inserted and stability, alignment and range of motion checked.${f.pat === 'RESURFACED' ? ' Patella resurfaced.' : ' Patellar osteophytes removed and denervated.'}`,
        'Bone surfaces cleaned with pulse lavage and the final components cemented in place; excess cement removed. Polyethylene insert fixed.',
      ],
      close: 'Arthrotomy closed with the knee in flexion; wound closed in layers and skin closed with staples. Sterile compression dressing applied.',
    },
    hemi: {
      label: 'Hemiarthroplasty hip', pos: 'LATERAL DECUBITUS', tq: false, anaes: 'SPINAL ANAESTHESIA',
      fields: [opnSel('pros', 'Prosthesis', ['BIPOLAR (CEMENTED)', 'BIPOLAR (UNCEMENTED)', 'AUSTIN MOORE'])],
      imps: ['BIPOLAR PROSTHESIS', 'AUSTIN MOORE PROSTHESIS', 'BONE CEMENT'],
      defImps: [{ name: 'BIPOLAR PROSTHESIS' }],
      name: (f, x) => `${/BIPOLAR/.test(f.pros) ? `${f.pros.replace(/^BIPOLAR \((.*)\)$/, '$1')} BIPOLAR` : 'AUSTIN MOORE'} HEMIARTHROPLASTY ${x.side} HIP`,
      steps: (f) => [
        'Posterior (Southern) approach: curved incision centred on the greater trochanter; fascia lata and gluteus maximus split; short external rotators released, protecting the sciatic nerve; capsule opened.',
        'Femoral head removed with a corkscrew and its size measured. Neck osteotomy done 1-1.5cm above the lesser trochanter.',
        `Femoral canal prepared with box chisel and rasps; prosthesis ${/CEMENTED\)/.test(f.pros) ? 'cemented' : 'inserted'} with appropriate anteversion. Hip reduced and found stable through range of motion.`,
        'Capsule and short external rotators repaired.',
      ],
    },
  } },

  // ------------------------------------------------------------------ ARTHROSCOPY
  arthroscopy: { label: 'Arthroscopy', items: {
    acl: {
      label: 'Arthroscopic ACL reconstruction', pos: 'SUPINE WITH ARTHROSCOPY LEG HOLDER', tq: true, anaes: 'SPINAL ANAESTHESIA',
      fields: [opnSel('graft', 'Graft', ['HAMSTRING (SEMITENDINOSUS + GRACILIS) AUTOGRAFT', 'BONE-PATELLAR TENDON-BONE AUTOGRAFT', 'PERONEUS LONGUS AUTOGRAFT']), opnTxt('gsize', 'Graft diameter (mm)', 'e.g. 8'),
        opnSel('menisc', 'Meniscus', ['NONE', 'PARTIAL MEDIAL MENISCECTOMY', 'PARTIAL LATERAL MENISCECTOMY', 'MEDIAL MENISCUS REPAIR', 'LATERAL MENISCUS REPAIR'])],
      imps: ['CORTICAL BUTTON (ENDOBUTTON)', 'BIOABSORBABLE INTERFERENCE SCREW', 'TITANIUM INTERFERENCE SCREW'],
      defImps: [{ name: 'CORTICAL BUTTON (ENDOBUTTON)' }, { name: 'BIOABSORBABLE INTERFERENCE SCREW' }],
      name: (f, x) => `ARTHROSCOPIC ACL RECONSTRUCTION WITH ${f.graft.replace(/ \(.*\)/, '')} ${x.side}${f.menisc !== 'NONE' ? ` + ${f.menisc}` : ''}`,
      steps: (f, x) => [
        'Standard anterolateral and anteromedial portals made. Diagnostic arthroscopy done: ACL found torn; other findings noted.',
        ...(f.menisc !== 'NONE' ? [`${f.menisc[0] + f.menisc.slice(1).toLowerCase()} done.`] : []),
        /HAMSTRING/.test(f.graft) ? 'Semitendinosus and gracilis harvested through an oblique incision over the pes anserinus with a tendon stripper, prepared as a quadrupled graft and whip-stitched.'
          : /PATELLAR/.test(f.graft) ? 'Central third bone-patellar tendon-bone graft harvested through a midline incision and prepared.' : 'Peroneus longus harvested through a small lateral incision above the lateral malleolus and prepared.',
        `Graft sized${f.gsize ? ` at ${f.gsize}mm` : ''} and pre-tensioned. ACL stump debrided and notchplasty done as required.`,
        'Femoral tunnel drilled through the anteromedial portal at the anatomical footprint; tibial tunnel drilled with the tibial guide at the anatomical footprint.',
        `Graft passed and fixed on the femoral side${x.find('BUTTON') ? ` with ${x.find('BUTTON')}` : ''}; knee cycled and graft fixed on the tibial side in 20-30 degrees flexion${x.find('INTERFERENCE') ? ` with ${x.find('INTERFERENCE')}` : ''}.`,
        'Graft tension, absence of impingement and stability (Lachman) checked.',
      ],
      close: 'Portals and graft harvest site closed with ethilon sutures. Sterile compression dressing and long knee brace applied.',
    },
    meniscus: {
      label: 'Arthroscopic meniscectomy / meniscal repair', pos: 'SUPINE WITH ARTHROSCOPY LEG HOLDER', tq: true, anaes: 'SPINAL ANAESTHESIA',
      fields: [opnSel('which', 'Meniscus', ['MEDIAL MENISCUS', 'LATERAL MENISCUS']), opnSel('proc', 'Procedure', ['PARTIAL MENISCECTOMY', 'MENISCAL REPAIR (ALL-INSIDE)', 'MENISCAL REPAIR (INSIDE-OUT)']), opnTxt('tear', 'Tear (e.g. bucket handle, posterior horn)', '')],
      name: (f, x) => `ARTHROSCOPIC ${f.proc.replace(/ \(.*\)/, '')} OF ${f.which} ${x.side}`,
      steps: (f) => [
        'Standard anterolateral and anteromedial portals made. Diagnostic arthroscopy done.',
        `${f.which[0] + f.which.slice(1).toLowerCase()} tear${f.tear ? ` (${f.tear.toLowerCase()})` : ''} found.`,
        /REPAIR/.test(f.proc) ? `Tear edges freshened with a rasp and repaired with ${/ALL/.test(f.proc) ? 'all-inside meniscal repair devices' : 'inside-out vertical mattress sutures through a posteromedial / posterolateral incision'}; repair found stable on probing.`
          : 'Torn unstable portion excised with punches and shaver back to a stable rim, preserving as much meniscus as possible; rim found stable on probing.',
      ],
      close: 'Joint washed; portals closed with ethilon sutures. Sterile compression dressing applied.',
    },
    dxScope: {
      label: 'Diagnostic arthroscopy, debridement and lavage (knee)', pos: 'SUPINE WITH ARTHROSCOPY LEG HOLDER', tq: true, anaes: 'SPINAL ANAESTHESIA',
      fields: [opnTxt('findings', 'Findings', 'e.g. grade III chondral changes medial compartment')],
      name: (f, x) => `DIAGNOSTIC ARTHROSCOPY, DEBRIDEMENT AND LAVAGE ${x.side} KNEE`,
      steps: (f) => [
        'Standard anterolateral and anteromedial portals made.',
        `Systematic diagnostic arthroscopy done of the suprapatellar pouch, patellofemoral joint, medial and lateral gutters, medial and lateral compartments and the notch${f.findings ? `. Findings: ${f.findings.toLowerCase()}` : ''}.`,
        'Loose fragments, unstable cartilage flaps and inflamed synovium debrided with the shaver; thorough lavage done.',
      ],
      close: 'Portals closed with ethilon sutures. Sterile compression dressing applied.',
    },
    bankart: {
      label: 'Arthroscopic Bankart repair', pos: 'LATERAL DECUBITUS', tq: false, anaes: 'GENERAL ANAESTHESIA',
      fields: [opnSel('remp', 'Remplissage', YESNO)],
      imps: ['SUTURE ANCHORS'], defImps: [{ name: 'SUTURE ANCHORS', screws: [{ type: 'SUTURE ANCHORS', n: '3' }] }],
      name: (f, x) => `ARTHROSCOPIC BANKART REPAIR ${x.side} SHOULDER${f.remp === 'YES' ? ' WITH REMPLISSAGE' : ''}`,
      steps: (f, x) => [
        'Posterior viewing portal and anterior working portals made. Diagnostic arthroscopy done: anteroinferior labral tear (Bankart lesion) found.',
        'Labrum mobilised off the glenoid neck with an elevator and the glenoid rim freshened with a rasp / burr.',
        `Labrum and capsule repaired to the glenoid rim with ${x.screws || 'suture anchors'} placed from inferior to superior, with capsular shift.`,
        ...(f.remp === 'YES' ? ['Remplissage done: infraspinatus tenodesed into the Hill-Sachs lesion with a suture anchor.'] : []),
        'Repair found stable on probing.',
      ],
      close: 'Portals closed with ethilon sutures. Sterile dressing and shoulder immobiliser applied.',
    },
    cuff: {
      label: 'Arthroscopic rotator cuff repair', pos: 'BEACH CHAIR', tq: false, anaes: 'GENERAL ANAESTHESIA',
      fields: [opnSel('tech', 'Repair', ['SINGLE ROW', 'DOUBLE ROW (SUTURE BRIDGE)']), opnSel('sad', 'Subacromial decompression', ['YES', 'NO'])],
      imps: ['SUTURE ANCHORS', 'KNOTLESS ANCHORS'], defImps: [{ name: 'SUTURE ANCHORS', screws: [{ type: 'SUTURE ANCHORS', n: '2' }] }],
      name: (f, x) => `ARTHROSCOPIC ${f.tech.replace(/ \(.*\)/, '')} ROTATOR CUFF REPAIR ${x.side} SHOULDER${f.sad === 'YES' ? ' WITH SUBACROMIAL DECOMPRESSION' : ''}`,
      steps: (f, x) => [
        'Posterior, lateral and anterior portals made. Glenohumeral diagnostic arthroscopy done; scope moved to the subacromial space.',
        `Bursectomy done${f.sad === 'YES' ? ' and acromioplasty performed with a burr' : ''}. Cuff tear assessed and its edges debrided; footprint on the greater tuberosity prepared.`,
        `Cuff repaired to the footprint in ${f.tech.toLowerCase()} fashion with ${x.screws || 'suture anchors'}; repair found secure.`,
      ],
      close: 'Portals closed with ethilon sutures. Sterile dressing and arm pouch / abduction brace applied.',
    },
  } },

  // ------------------------------------------------------------------ TUMOUR
  tumour: { label: 'Tumour', items: {
    excision: {
      label: 'Excision of benign lesion (e.g. osteochondroma)', pos: 'SUPINE', tq: true, anaes: 'SPINAL ANAESTHESIA',
      fields: [opnTxt('lesion', 'Lesion', 'OSTEOCHONDROMA'), opnTxt('site', 'Site', 'e.g. DISTAL FEMUR')],
      name: (f, x) => `EXCISION OF ${f.lesion || 'LESION'} ${f.site} ${x.side}`,
      steps: (f) => [
        `Incision made over the lesion at the ${(f.site || 'site').toLowerCase()}; skin and subcutaneous tissue incised and the neurovascular structures identified and protected.`,
        'Lesion exposed and excised at its base along with the cartilage cap and overlying perichondrium / pseudocapsule; base smoothened.',
        'Specimen sent for histopathological examination.',
      ],
    },
    curettage: {
      label: 'Extended curettage ± adjuvant ± cement / bone graft', pos: 'SUPINE', tq: true, anaes: 'SPINAL ANAESTHESIA',
      fields: [opnTxt('lesion', 'Lesion', 'GIANT CELL TUMOUR'), opnTxt('site', 'Site', 'e.g. PROXIMAL TIBIA'), opnSel('adj', 'Adjuvant', ['HIGH SPEED BURR + PHENOL', 'HIGH SPEED BURR + HYDROGEN PEROXIDE', 'HIGH SPEED BURR', 'NONE']),
        opnSel('fill', 'Filled with', ['BONE CEMENT', 'BONE GRAFT', 'BONE GRAFT SUBSTITUTE', 'BONE CEMENT + SUBCHONDRAL BONE GRAFT'])],
      imps: ['BONE CEMENT', 'LOCKING PLATE'],
      name: (f, x) => `EXTENDED CURETTAGE${f.adj !== 'NONE' ? ` WITH ${f.adj}` : ''} AND ${f.fill} FOR ${f.lesion || 'LESION'} ${f.site} ${x.side}`,
      steps: (f, x) => [
        `Incision made over the lesion at the ${(f.site || 'site').toLowerCase()}; a large cortical window made over the lesion.`,
        'Tumour tissue thoroughly curetted out and sent for histopathological examination.',
        ...(f.adj !== 'NONE' ? [`Cavity walls extended with a high speed burr${/PHENOL/.test(f.adj) ? ' and treated with phenol, followed by alcohol and saline wash' : /PEROXIDE/.test(f.adj) ? ' and treated with hydrogen peroxide' : ''}.`] : []),
        `Cavity filled with ${f.fill.toLowerCase()}${x.imps && x.has('PLATE') ? ` and stabilised with ${x.find('PLATE')}` : ''}.`,
      ],
    },
    biopsy: {
      label: 'Biopsy (open / core)', pos: 'SUPINE', tq: false, anaes: 'SPINAL ANAESTHESIA',
      fields: [opnSel('type', 'Type', ['OPEN BIOPSY', 'CORE NEEDLE BIOPSY']), opnTxt('site', 'Site', 'e.g. PROXIMAL HUMERUS')],
      name: (f, x) => `${f.type} ${f.site} ${x.side}`,
      steps: (f) => (f.type === 'OPEN BIOPSY'
        ? ['Longitudinal incision made in line with the planned definitive surgery, through a single compartment, avoiding neurovascular structures.', 'Representative tissue taken from the periphery of the lesion; specimen sent for histopathological examination (and culture). Meticulous haemostasis achieved.']
        : ['Trocar inserted through a stab incision in line with the planned definitive surgery under C-arm guidance.', 'Multiple cores taken from the lesion and sent for histopathological examination (and culture).']),
      close: (f) => (f.type === 'OPEN BIOPSY' ? 'Wound closed in layers without a drain (or drain brought out in line with the incision). Sterile dressing applied.' : 'Stab incision closed and sterile dressing applied.'),
    },
    wide: {
      label: 'Wide excision ± reconstruction', pos: 'SUPINE', tq: false, anaes: 'GENERAL ANAESTHESIA',
      fields: [opnTxt('lesion', 'Lesion', 'e.g. OSTEOSARCOMA'), opnTxt('site', 'Site', 'e.g. DISTAL FEMUR'), opnSel('recon', 'Reconstruction', ['MODULAR ENDOPROSTHESIS', 'CEMENT SPACER', 'ARTHRODESIS', 'NONE'])],
      imps: ['MODULAR ENDOPROSTHESIS', 'BONE CEMENT'],
      name: (f, x) => `WIDE EXCISION OF ${f.lesion || 'TUMOUR'} ${f.site} ${x.side}${f.recon !== 'NONE' ? ` WITH ${f.recon} RECONSTRUCTION` : ''}`,
      steps: (f) => [
        'Incision planned to include the biopsy tract en bloc.',
        'Tumour exposed with a cuff of normal tissue all around; neurovascular bundle identified, dissected and protected.',
        'Bone osteotomised at the planned level with an adequate margin; tumour removed en bloc and sent for histopathological examination with margins marked.',
        ...(f.recon !== 'NONE' ? [`Reconstruction done with ${f.recon.toLowerCase()}; stability and limb length checked.`] : []),
      ],
    },
  } },

  // ------------------------------------------------------------------ PAEDIATRICS
  paediatrics: { label: 'Paediatrics', items: {
    crpp: {
      label: 'CRPP supracondylar humerus', pos: 'SUPINE WITH ARM ON HAND TABLE', tq: false, anaes: 'GENERAL ANAESTHESIA',
      fields: [opnSel('config', 'K-wires', ['2 LATERAL DIVERGENT K-WIRES', '3 LATERAL DIVERGENT K-WIRES', 'CROSSED (MEDIAL + LATERAL) K-WIRES'])],
      imps: ['K-WIRES'], defImps: [{ name: 'K-WIRES', screws: [{ type: 'K-WIRES', n: '2' }] }],
      name: (f, x) => `CLOSED REDUCTION AND PERCUTANEOUS PINNING ${x.side} SUPRACONDYLAR HUMERUS`,
      steps: (f) => [
        'Closed reduction done with traction-countertraction, correction of medial / lateral displacement and flexion of the elbow with pressure over the olecranon. Reduction confirmed under C-arm in AP and lateral views (Baumann angle, anterior humeral line).',
        `Fracture fixed with ${f.config.toLowerCase()} under C-arm${/CROSSED/.test(f.config) ? ', the medial wire placed through a small incision with the elbow in extension to protect the ulnar nerve' : ''}. Stability checked.`,
        'Wires bent and cut outside the skin.',
      ],
      close: 'Pin sites dressed. Above elbow slab applied.',
      slab: 'ABOVE ELBOW SLAB',
    },
    tens: {
      label: 'Titanium elastic nailing (TENS)', pos: 'SUPINE', tq: false, anaes: 'GENERAL ANAESTHESIA',
      fields: [opnSel('bone', 'Bone', ['FEMUR', 'BOTH BONE FOREARM', 'TIBIA', 'HUMERUS'])],
      imps: ['TENS NAILS'], defImps: [{ name: 'TENS NAILS', size: '', screws: [] }],
      name: (f, x) => `CLOSED REDUCTION AND TITANIUM ELASTIC NAILING ${x.side} ${f.bone}`,
      steps: (f, x) => [
        'Entry points made with an awl through small incisions at the metaphysis, avoiding the physis.',
        `${x.imps || 'Titanium elastic nails'} of appropriate diameter (about 40% of the canal) pre-bent into a C-shape and advanced to the fracture; fracture reduced closed and the nails passed across it under C-arm, creating balanced opposing curves.`,
        'Nail ends cut and bent, left just outside the bone. Reduction and nail position confirmed under C-arm.',
      ],
      close: 'Incisions closed and sterile dressing applied.',
    },
    ctev: {
      label: 'CTEV — percutaneous tenotomy', pos: 'PRONE', tq: false, anaes: 'GENERAL ANAESTHESIA',
      fields: [],
      name: (f, x) => `PERCUTANEOUS TENDO-ACHILLES TENOTOMY ${x.side} FOOT (PONSETI)`,
      steps: () => [
        'Foot held in maximum dorsiflexion; tendo-Achilles palpated about 1.5cm above its insertion.',
        'Tendon divided percutaneously with a fine blade from medial to lateral; a palpable give felt and dorsiflexion improved to about 20 degrees.',
      ],
      close: 'Stab wound dressed. Above knee cast applied with the foot in abduction and dorsiflexion.',
    },
    crCast: {
      label: 'Closed reduction and cast', pos: 'SUPINE', tq: false, anaes: 'GENERAL ANAESTHESIA',
      fields: [opnTxt('frac', 'Fracture', 'e.g. BOTH BONE FOREARM'), opnSel('cast', 'Cast', ['ABOVE ELBOW CAST', 'BELOW ELBOW CAST', 'ABOVE KNEE CAST', 'BELOW KNEE CAST', 'HIP SPICA'])],
      name: (f, x) => `CLOSED REDUCTION AND ${f.cast} ${x.side} ${f.frac}`,
      steps: (f) => [
        `Closed reduction of the ${(f.frac || 'fracture').toLowerCase()} done under C-arm by traction and manipulation; acceptable alignment achieved.`,
        `Well-padded ${f.cast.toLowerCase()} applied and moulded; reduction re-checked under C-arm.`,
      ],
      close: 'Distal circulation checked after casting.',
      noWash: true,
    },
  } },

  // ------------------------------------------------------------------ OTHERS
  general: { label: 'Others (debridement, implant removal, amputation…)', items: {
    debridement: {
      label: 'Wound debridement and wash', pos: 'SUPINE', tq: false, anaes: 'SPINAL ANAESTHESIA',
      fields: [opnTxt('site', 'Wound site', 'e.g. LEFT LEG'), opnTxt('findings', 'Findings', 'e.g. slough, devitalised muscle'), opnSel('culture', 'Tissue sent for culture', ['YES', 'NO']), opnSel('vac', 'Dressing', ['STERILE DRESSING', 'NEGATIVE PRESSURE WOUND THERAPY (VAC)'])],
      name: (f, x) => `WOUND DEBRIDEMENT AND WASH ${f.site} ${x.side}`,
      steps: (f) => [
        `Wound inspected${f.findings ? `: ${f.findings.toLowerCase()}` : ''}.`,
        'All necrotic, devitalised and contaminated tissue excised back to healthy bleeding tissue; loose avascular bone fragments removed.',
        ...(f.culture === 'YES' ? ['Deep tissue sent for culture and sensitivity.'] : []),
        'Wound washed thoroughly with copious normal saline (pulse lavage) and hydrogen peroxide / povidone iodine.',
      ],
      close: (f) => (/VAC/.test(f.vac) ? 'Negative pressure wound therapy (VAC) dressing applied.' : 'Wound left open / loosely approximated and a sterile dressing applied.'),
      noWash: true,
    },
    implantRemoval: {
      label: 'Implant removal', pos: 'SUPINE', tq: true, anaes: 'SPINAL ANAESTHESIA',
      fields: [opnTxt('implant', 'Implant removed', 'e.g. 4.5MM NARROW LCP'), opnTxt('site', 'Site', 'e.g. FEMUR')],
      name: (f, x) => `REMOVAL OF ${f.implant || 'IMPLANT'} ${x.side} ${f.site}`,
      steps: (f) => [
        'Incision made through the previous scar; implant exposed.',
        `${f.implant ? f.implant[0] + f.implant.slice(1).toLowerCase() : 'Implant'} and all screws removed. Screw holes and the bed curetted.`,
        'Bone found united; absence of retained implant confirmed under C-arm.',
      ],
    },
    amputation: {
      label: 'Amputation', pos: 'SUPINE', tq: true, anaes: 'SPINAL ANAESTHESIA',
      fields: [opnSel('level', 'Level', ['BELOW KNEE', 'ABOVE KNEE', 'BELOW ELBOW', 'ABOVE ELBOW', 'TRANSMETATARSAL', 'RAY', 'SYME']), opnTxt('ind', 'Indication', 'e.g. CRUSH INJURY, GANGRENE')],
      name: (f, x) => `${f.level} AMPUTATION ${x.side}`,
      steps: (f) => [
        `${f.ind ? `Indication: ${f.ind.toLowerCase()}. ` : ''}Skin flaps marked${/BELOW KNEE/.test(f.level) ? ' (long posterior flap)' : /ABOVE KNEE/.test(f.level) ? ' (equal anterior and posterior flaps)' : ''} and incised.`,
        'Muscles divided; major vessels identified, doubly ligated and divided. Nerves pulled down gently, ligated and cut sharply to retract proximally.',
        `Bone cut at the planned level with a saw${/BELOW KNEE/.test(f.level) ? ', the tibial end bevelled anteriorly and the fibula cut 1-2cm shorter' : ''}; sharp edges rasped smooth.`,
        'Tourniquet released and meticulous haemostasis achieved. Myodesis / myoplasty done over the bone end.',
      ],
      close: 'Fascia and skin closed without tension over a drain. Stump dressed with a well-padded crepe bandage.',
      noWash: true,
    },
    sequestrectomy: {
      label: 'Sequestrectomy / saucerisation', pos: 'SUPINE', tq: true, anaes: 'SPINAL ANAESTHESIA',
      fields: [opnTxt('bone', 'Bone', 'e.g. TIBIA'), opnSel('beads', 'Antibiotic beads / cement', ['NO', 'YES'])],
      name: (f, x) => `SEQUESTRECTOMY AND SAUCERISATION ${x.side} ${f.bone}`,
      steps: (f) => [
        'Incision made over the involved bone, including the sinus tract; sinus tract excised.',
        'Cortical window made; sequestrum removed and pus / infected granulation tissue curetted out until healthy bleeding bone (paprika sign). Margins saucerised.',
        'Tissue sent for culture, sensitivity and histopathological examination.',
        ...(f.beads === 'YES' ? ['Cavity filled with antibiotic-loaded cement beads.'] : []),
      ],
    },
    ssg: {
      label: 'Split skin graft', pos: 'SUPINE', tq: false, anaes: 'SPINAL ANAESTHESIA',
      fields: [opnTxt('recipient', 'Recipient site', 'e.g. LEFT LEG'), opnTxt('donor', 'Donor site', 'e.g. LEFT THIGH')],
      name: (f) => `SPLIT SKIN GRAFTING ${f.recipient}`,
      steps: (f) => [
        'Recipient bed prepared: granulation tissue scraped to a healthy bleeding bed and washed.',
        `Split thickness skin graft harvested from the ${(f.donor || 'thigh').toLowerCase()} with a dermatome / Humby knife, meshed and placed over the recipient bed, and secured with staples / sutures.`,
      ],
      close: 'Graft dressed with paraffin gauze and a tie-over / bulky dressing; donor site dressed.',
      noWash: true,
    },
  } },
};

// ---- Template procedures in the note
const opnTpl = (p) => OPN_TPL[p.cat]?.items?.[p.tpl];
// A template procedure → { name, lines, implants } in the same shape as a trauma procedure.
function opnTplProc(p) {
  const t = opnTpl(p);
  if (!t) return null;
  const U = (s) => String(s || '').toUpperCase().trim();
  const f = Object.fromEntries(t.fields.map((fd) => [fd.k, U(p.f?.[fd.k] ?? fd.def)]));
  const imps = (p.implants || []).filter((i) => String(i.implantCustom || '').trim());
  const impName = (i) => [String(i.size || '').trim(), String(i.implantCustom || '').trim()].filter(Boolean).join(' ').toUpperCase();
  const allScrews = imps.flatMap((i) => opnScrews(i));
  const x = {
    side: U(p.side),
    imps: opnJoin(imps.map(impName)),
    screws: allScrews.length ? opnJoin(allScrews.map(opnScrewBase)) : '',
    has: (w) => imps.some((i) => impName(i).includes(w)) || allScrews.some((s) => opnScrewType(s).includes(w)),
    find: (w) => {
      const i = imps.find((im) => impName(im).includes(w));
      if (i) return [impName(i), ...opnScrews(i).map(opnScrewBase)].join(' with ');
      const s = allScrews.find((sc) => opnScrewType(sc).includes(w));
      return s ? opnScrewBase(s) : '';
    },
  };
  const name = t.name(f, x).replace(/\s+/g, ' ').trim();
  const L = [...t.steps(f, x)];
  if (p.tourniquet === 'yes' && !/AMPUTATION/.test(name)) L.push('Tourniquet released and haemostasis achieved.');
  if (!t.noWash) L.push('Thorough wound wash given with normal saline. Haemostasis achieved.');
  if (p.drain === 'yes') L.push('Drain placed.');
  L.push((typeof t.close === 'function' ? t.close(f) : t.close) || 'Wound closed in layers with absorbable sutures and skin closed with ethilon / staples. Sterile dressing applied.');
  if (p.slab && p.slab !== 'NONE' && !(t.close && String(typeof t.close === 'function' ? t.close(f) : t.close).toUpperCase().includes(String(p.slab).toUpperCase()))) L.push(`${String(p.slab).toLowerCase()} applied.`);
  const implants = imps.flatMap((i) => [impName(i), ...opnScrewList(i)]);
  return { name, lines: L, implants };
}

// New template procedure (or after the template is changed): its usual position, tourniquet, fields, implants.
function opnTplFill(p) {
  const t = opnTpl(p);
  if (!t) return p;
  p.position = t.pos;
  p.tourniquet = t.tq ? 'yes' : 'no';
  p.slab = t.slab || 'NONE';
  p.f = Object.fromEntries(t.fields.map((fd) => [fd.k, fd.def]));
  p.implants = (t.defImps || []).map((d) => ({ implant: 'custom', implantCustom: d.name, size: d.size || '', screws: (d.screws || []).map((s) => ({ type: s.type, n: s.n || '', len: '', at: s.at || '' })) }));
  return p;
}

// Guess a template from the plan / diagnosis ("TKR", "PIVD L4-L5", "ACL TEAR"…).
const OPN_TPL_GUESS = [
  [/\bTKR\b|TOTAL KNEE|OA KNEE|OSTEOARTHRITIS (OF )?(BOTH |BILATERAL )?KNEE/, 'arthroplasty', 'tkr'],
  [/\bTHR\b|TOTAL HIP|AVN|AVASCULAR NECROSIS|OA HIP/, 'arthroplasty', 'thr'],
  [/ACL (TEAR|RECONSTRUCTION|INJURY)|ANTERIOR CRUCIATE/, 'arthroscopy', 'acl'],
  [/MENISC/, 'arthroscopy', 'meniscus'],
  [/BANKART|RECURRENT (ANTERIOR )?(SHOULDER )?DISLOCATION/, 'arthroscopy', 'bankart'],
  [/ROTATOR CUFF|SUPRASPINATUS TEAR/, 'arthroscopy', 'cuff'],
  [/DIAGNOSTIC ARTHROSCOPY/, 'arthroscopy', 'dxScope'],
  [/ACDF|CERVICAL (DISC|MYELOPATHY|SPONDYLOTIC)/, 'spine', 'acdf'],
  [/PIVD|DISC PROLAPSE|DISCECTOMY/, 'spine', 'discectomy'],
  [/CANAL STENOSIS|LAMINECTOMY/, 'spine', 'laminectomy'],
  [/LISTHESIS|POTT|TB SPINE|TUBERCULOSIS (OF )?(THE )?SPINE|SPONDYLODISCITIS|PEDICLE SCREW|D\d+ FRACTURE|L\d (BURST|WEDGE)/, 'spine', 'posStab'],
  [/GIANT CELL|\bGCT\b|CURETTAGE|ANEURYSMAL BONE CYST|\bABC\b|SIMPLE BONE CYST/, 'tumour', 'curettage'],
  [/OSTEOCHONDROMA|EXOSTOSIS/, 'tumour', 'excision'],
  [/BIOPSY/, 'tumour', 'biopsy'],
  [/OSTEOSARCOMA|EWING|CHONDROSARCOMA|WIDE EXCISION|MEGAPROSTHESIS|ENDOPROSTHESIS/, 'tumour', 'wide'],
  [/CTEV|CLUB ?FOOT|TENOTOMY/, 'paediatrics', 'ctev'],
  [/\bCRPP\b/, 'paediatrics', 'crpp'],
  [/IMPLANT REMOVAL|REMOVAL OF IMPLANT|IMPLANT IN SITU/, 'general', 'implantRemoval'],
  [/AMPUTATION|GANGRENE/, 'general', 'amputation'],
  [/SEQUESTR|CHRONIC OSTEOMYELITIS|SAUCERI/, 'general', 'sequestrectomy'],
  [/\bSSG\b|SKIN GRAFT/, 'general', 'ssg'],
  [/DEBRIDEMENT|WOUND (WASH|DEHISCENCE)|INFECTED WOUND/, 'general', 'debridement'],
];
function opnTplGuess(text) {
  const t = String(text || '').toUpperCase();
  const hit = OPN_TPL_GUESS.find(([re]) => re.test(t));
  return hit ? { cat: hit[1], tpl: hit[2] } : null;
}

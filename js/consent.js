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
  'மேலும், படுத்த படுக்கையாக இருப்பதால் படுக்கைப் புண் வருவதற்கு வாய்ப்புள்ளது என அறிவேன். மேலும் காலில் உள்ள இரத்த நாளங்களில் இரத்தம் கட்டிப் போகலாம் என அறிவேன். அந்தக் கட்டி உடைந்து நுரையீரலில் உள்ள இரத்தக் குழாயை அடைத்து மூச்சுத்திணறல், மாரடைப்பு ஏற்படலாம் என அறிவேன்.',
  `மேலும், அறுவை சிகிச்சையின் போது {SCREW} செலுத்தும் போது எனது ${bone} எலும்பு உடைய வாய்ப்புள்ளது என அறிவேன். மேலும் எலும்பில் பொருத்திய உலோகம் வளைந்து உடையவும், விலகவும் வாய்ப்புள்ளது என அறிவேன். தேவைப்பட்டால் மறு அறுவை சிகிச்சை செய்யும் நிலை வரலாம் என அறிவேன்.`,
  'அறுவை சிகிச்சையின் போது உயிர்பிரிய வாய்ப்புள்ளது என அறிவேன்.',
  'மேலும், புண் சீழ்பிடித்தல், இரத்தத்தில் கிருமி தொற்று ஏற்படுதல், எலும்புகள் சீழ்பிடித்தல் போன்றவை ஏற்படலாம் என அறிவேன்.',
  'ஆயினும் இவ்வறுவை சிகிச்சை எனது பூரண நலன் கருதி செய்யப்படுவதால், மேற்கூறிய பின்விளைவுகள் ஏற்படுமாயின் அதற்கு மருத்துவரோ, மருத்துவமனை ஊழியரோ, நிர்வாகமோ பொறுப்பல்ல என ஒப்புக்கொள்கிறேன்.',
];
const CONSENT_BLOOD_SPINE = 'மேலும், இரத்த நாளங்கள் சேதம் அடைந்து அதிக இரத்தம் இழந்து உயிரிழக்க வாய்ப்புள்ளது என அறிவேன். அதற்கு இரத்தம் ஏற்றும் நிலை வரலாம் என அறிவேன். அவ்வாறு ஏற்றும் இரத்தத்திற்கு ஒவ்வாமை ஏற்பட்டு உயிரிழக்க வாய்ப்புள்ளது என அறிவேன்.';
const CONSENT_ANAES_SPINE = 'மேலும், மயக்க மருந்து ஒவ்வாமையால் மூச்சுத்திணறல், மாரடைப்பு, மேஜையில் மரணம் போன்றவை ஏற்படலாம் என அறிவேன். தேவைப்பட்டால் செயற்கை சுவாசத்தில் இருக்கும் நிலை வரலாம் என அறிவேன்.';
const CONSENT_LIMB_OPEN = (limb) => `{NAME} ஆகிய எனக்கு அடிபட்டு அரசு இராசாசி மருத்துவமனையில் அனுமதிக்கப்பட்டேன். என்னைப் பரிசோதனை செய்த மருத்துவர்கள் எனது ${limb} எலும்பு முறிவு ஏற்பட்டுள்ளது என்று கூறினர். அதற்கு {PROC} கொண்டு அறுவை சிகிச்சை செய்து சரிசெய்ய வேண்டும் என்று கூறினர். இவ்வறுவை சிகிச்சைக்கு நான் என் மனப்பூர்வ சம்மதம் அளிக்கிறேன்.`;


// ---- Forms beyond trauma (wording written for Callus; the department should review it) ----
const CONSENT_ANAES = 'மேலும், அறுவை சிகிச்சையின் போது மயக்க மருந்து கொடுப்பதால் மூச்சுத்திணறல், மாரடைப்பு மற்றும் மேசை மேல் மரணம் போன்றவை ஏற்படலாம் என அறிவேன். தேவைப்பட்டால் அறுவை சிகிச்சைக்குப் பின்னர் செயற்கை சுவாசம் பொருத்தும் நிலை வரலாம் என அறிவேன்.';
const CONSENT_SSI = 'மேலும், அறுவை சிகிச்சைக்குப் பின்னர் புண் சீழ் பிடித்தல் (SSI), இரத்தத்தில் கிருமி தொற்று ஏற்படுதல் (Septicemia) மற்றும் எலும்பில் சீழ்பிடித்தல் (Osteomyelitis) போன்ற பல சிக்கல்கள் ஏற்பட வாய்ப்புள்ளது என அறிவேன்.';
const CONSENT_CLOSE = 'அனைத்து முன்னெச்சரிக்கை நடவடிக்கைகளுடன் இவ்வறுவை சிகிச்சை செய்யப்பட்டாலும், மேற்குறிப்பிட்ட ஏதேனும் ஒன்று ஏற்படுமாயின் அதற்கு மருத்துவரோ மருத்துவமனை நிர்வாகமோ பொறுப்பல்ல என்பதை ஒப்புக்கொள்கிறேன்.';
const CONSENT_DVT = 'மேலும், அறுவை சிகிச்சைக்குப் பின்னர் காலில் உள்ள இரத்த நாளங்களில் இரத்தம் கட்டி (DVT), அந்தக் கட்டி நுரையீரலுக்குச் சென்று அடைத்து (Pulmonary embolism) மூச்சுத்திணறல், மாரடைப்பு மற்றும் உயிரிழப்பு ஏற்படலாம் என அறிவேன்.';
const CONSENT_FORMS_MORE = {
  arthroplasty: {
    label: 'Arthroplasty (joint replacement)', bone: 'கால்', spine: false, title: 'அறுவை சிகிச்சைக்கான எடுத்துரைக்கப்பட்ட ஒப்புதல் படிவம்',
    paras: [
      '{NAME} ஆகிய எனக்கு நீண்ட நாட்களாக மூட்டு வலி மற்றும் நடப்பதில் சிரமம் இருப்பதால் அரசு இராசாசி மருத்துவமனையில் அனுமதிக்கப்பட்டேன். என்னைப் பரிசோதனை செய்த மருத்துவர்கள் எனது மூட்டு தேய்மானம் அடைந்துள்ளது / சேதம் அடைந்துள்ளது என்று கூறினர். அதற்கு பாதிக்கப்பட்ட மூட்டின் பகுதிகளை அகற்றி {PROC} பொருத்தும் மூட்டு மாற்று அறுவை சிகிச்சை செய்ய வேண்டும் என்று கூறினர். இவ்வறுவை சிகிச்சைக்கு நான் என் மனப்பூர்வ சம்மதம் அளிக்கிறேன்.',
      CONSENT_ANAES,
      'மேலும், இரத்த நாளங்கள் சேதம் அடைந்து அதிக இரத்தம் இழப்பு ஏற்பட வாய்ப்புள்ளது என அறிவேன். அதற்கு இரத்தம் ஏற்றும் நிலை வரலாம் என அறிவேன். அவ்வாறு ஏற்றும் இரத்தத்தினால் ஒவ்வாமை ஏற்பட்டு உயிரிழக்க வாய்ப்புள்ளது என அறிவேன்.',
      CONSENT_DVT,
      'மேலும், நரம்புகள் சேதம் அடைந்து காலில் உணர்ச்சியின்மை அல்லது பாதத்தைத் தூக்க இயலாமை (Foot drop) ஏற்பட வாய்ப்புள்ளது என அறிவேன்.',
      'மேலும், உலோகத்தினால் ஆன செயற்கை மூட்டு பொருத்திய பின்னர் காலின் நீளம் குறைந்தோ அல்லது கூடியோ (கால் நீள வேறுபாடு) போக வாய்ப்புள்ளது என அறிவேன். செயற்கை மூட்டு இடம் விலகுதல் (Dislocation), தளர்ந்து போதல் (Loosening), மூட்டு இறுக்கம், தொடர்ந்து வலி இருத்தல், செயற்கை மூட்டைச் சுற்றியுள்ள எலும்பு உடைதல் போன்றவை ஏற்படலாம் என அறிவேன். செயற்கை மூட்டு நாளடைவில் தேய்மானம் அடைந்து பல ஆண்டுகளுக்குப் பின்னர் மறு அறுவை சிகிச்சை (Revision) தேவைப்படலாம் என அறிவேன்.',
      'மேலும், செயற்கை மூட்டில் கிருமி தொற்று ஏற்பட்டால் நீண்ட நாட்கள் ஆன்டிபயாடிக் சிகிச்சை, செயற்கை மூட்டை அகற்றுதல் மற்றும் ஒன்றுக்கு மேற்பட்ட மறு அறுவை சிகிச்சைகள் தேவைப்படலாம் என அறிவேன்.',
      CONSENT_SSI,
      CONSENT_CLOSE,
    ],
  },
  arthroscopy: {
    label: 'Arthroscopy (ligament / meniscus / labrum)', bone: 'மூட்டு', spine: false, title: 'அறுவை சிகிச்சைக்கான எடுத்துரைக்கப்பட்ட ஒப்புதல் படிவம்',
    paras: [
      '{NAME} ஆகிய எனக்கு மூட்டு வலி மற்றும் மூட்டு ஆட்டம் (Instability) காரணமாக அரசு இராசாசி மருத்துவமனையில் அனுமதிக்கப்பட்டேன். என்னைப் பரிசோதனை செய்த மருத்துவர்கள் எனது மூட்டினுள் உள்ள தசைநார் (Ligament) / சவ்வு (Meniscus / Labrum) கிழிந்துள்ளது என்று கூறினர். அதற்கு நுண்துளை (Arthroscopy) முறையில் {PROC} அறுவை சிகிச்சை செய்து சரிசெய்ய வேண்டும் என்று கூறினர். இவ்வறுவை சிகிச்சைக்கு நான் என் மனப்பூர்வ சம்மதம் அளிக்கிறேன்.',
      CONSENT_ANAES,
      'மேலும், நுண்துளை முறையில் செய்ய இயலாத நிலையில் திறந்த அறுவை சிகிச்சையாக மாற்ற நேரிடலாம் என அறிவேன். ஒட்டுவதற்கான தசைநார் (Graft) எடுக்கப்படும் இடத்தில் வலி, உணர்ச்சியின்மை, தசை பலவீனம் ஏற்படலாம் என அறிவேன்.',
      'மேலும், மூட்டினுள் கிருமி தொற்று (Septic arthritis) ஏற்பட்டால் மூட்டைச் சுத்தம் செய்ய மறு அறுவை சிகிச்சை தேவைப்படலாம் என அறிவேன். மூட்டில் இரத்தம் அல்லது நீர் சேர்தல், மூட்டு இறுக்கம் ஏற்படலாம் என அறிவேன்.',
      'மேலும், நரம்புகள், இரத்த நாளங்கள் சேதம் அடைந்து உணர்ச்சியின்மை அல்லது செயல் இழப்பு ஏற்படலாம் என அறிவேன். காலில் இரத்தம் கட்டுதல் (DVT) ஏற்படலாம் என அறிவேன்.',
      'மேலும், சவ்வு / தசைநார் சீரமைப்புக்குப் பின்னர் ஒட்டிய தசைநார் தளர்தல் அல்லது மீண்டும் கிழிதல் ஏற்படலாம் என்றும், மூட்டு ஆட்டம் முழுமையாகச் சரியாகாமல் போகலாம் என்றும் அறிவேன். பிரேஸ் (Brace) அணிதல் மற்றும் நீண்ட நாட்கள் இயன்முறை சிகிச்சை (Physiotherapy) தேவைப்படும் என்றும், அதனைத் தவறாமல் செய்ய வேண்டும் என்றும் அறிவேன்.',
      CONSENT_CLOSE,
    ],
  },
  paeds: {
    label: 'Paediatric (tenotomy / PMSTR / quadricepsplasty / release)', bone: 'கால்', spine: false, title: 'அறுவை சிகிச்சைக்கான எடுத்துரைக்கப்பட்ட ஒப்புதல் படிவம்',
    paras: [
      '{NAME} ஆகிய எனக்கு பிறவிக் குறைபாடு / தசை இறுக்கம் காரணமாக கால் / கை வளைவு (Deformity) அல்லது மூட்டு இறுக்கம் (Contracture) உள்ளது என்று என்னைப் பரிசோதனை செய்த மருத்துவர்கள் கூறினர். அதனைச் சரிசெய்ய {PROC} (தசைநார் வெட்டுதல் - Tenotomy, மென்திசு விடுவித்தல் - PMSTR, Quadricepsplasty போன்றவை) அறுவை சிகிச்சை செய்ய வேண்டும் என்று கூறினர். இவ்வறுவை சிகிச்சைக்கு நான் என் மனப்பூர்வ சம்மதம் அளிக்கிறேன்.',
      'மேலும், அறுவை சிகிச்சையின் போது மயக்க மருந்து கொடுப்பதால் மூச்சுத்திணறல், மாரடைப்பு மற்றும் உயிரிழப்பு போன்றவை ஏற்படலாம் என அறிவேன். தேவைப்பட்டால் அறுவை சிகிச்சைக்குப் பின்னர் செயற்கை சுவாசம் பொருத்தும் நிலை வரலாம் என அறிவேன்.',
      'மேலும், அறுவை சிகிச்சைக்குப் பின்னர் மாவுக்கட்டு (Cast) மற்றும் பிரேஸ் (Brace / Foot abduction brace) நீண்ட நாட்கள் அணிய வேண்டும் என்றும், தொடர் சிகிச்சைக்கும் இயன்முறை சிகிச்சைக்கும் (Physiotherapy) தவறாமல் வர வேண்டும் என்றும் அறிவேன்.',
      'மேலும், குறைபாடு முழுமையாகச் சரியாகாமல் போகவோ (Under-correction), அதிகமாகச் சரியாகவோ (Over-correction), வளர்ச்சியின் போது மீண்டும் வரவோ (Recurrence) வாய்ப்புள்ளது என்றும், அதற்கு மறு அறுவை சிகிச்சை தேவைப்படலாம் என்றும் அறிவேன்.',
      'மேலும், நரம்புகள், இரத்த நாளங்கள் சேதம் அடைந்து உணர்ச்சியின்மை, செயல் இழப்பு அல்லது இரத்த ஓட்டம் குறைதல் ஏற்படலாம் என அறிவேன். தோல் புண், தோல் அழுகுதல் (Skin necrosis), மாவுக்கட்டினால் அழுத்தப் புண், புண் ஆறாமை ஏற்படலாம் என அறிவேன்.',
      'மேலும், மூட்டு இறுக்கம், தசை பலவீனம் (Extension lag) ஏற்படலாம் என்றும், எலும்பு வளர்ச்சிப் பகுதி (Growth plate) பாதிக்கப்பட்டு கை / கால் நீளம் குறைதல் அல்லது வளைதல் ஏற்படலாம் என்றும் அறிவேன்.',
      CONSENT_SSI,
      CONSENT_CLOSE,
    ],
  },
};

const CONSENT_TPLS = {
  upper: {
    label: 'Upper limb', bone: 'கை', spine: false, title: 'அறுவை சிகிச்சைக்கான எடுத்துரைக்கப்பட்ட ஒப்புதல் படிவம்',
    paras: [CONSENT_LIMB_OPEN('கை'), ...CONSENT_LIMB_RISKS('கை', 'கைக்கு', 'கையைத்')],
  },
  lower: {
    label: 'Lower limb', bone: 'கால்', spine: false, title: 'அறுவை சிகிச்சைக்கான எடுத்துரைக்கப்பட்ட ஒப்புதல் படிவம்',
    paras: [CONSENT_LIMB_OPEN('கால்'), ...CONSENT_LIMB_RISKS('கால்', 'காலுக்கு', 'காலைத்')],
  },
  cervical: {
    label: 'Cervical spine', bone: 'கழுத்து', spine: true, title: 'அறுவை சிகிச்சைக்கான எடுத்துரைக்கப்பட்ட ஒப்புதல் படிவம்',
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
    label: 'Dorsolumbar spine', bone: 'முதுகு', spine: true, title: 'அறுவை சிகிச்சைக்கான எடுத்துரைக்கப்பட்ட ஒப்புதல் படிவம்',
    paras: [
      '{NAME} ஆகிய எனக்கு அடிபட்டு அரசு இராசாசி மருத்துவமனையில் அனுமதிக்கப்பட்டேன். என்னைப் பரிசோதித்த மருத்துவர்கள், முதுகு தண்டுவடத்தில் அடிபட்டு அதனால் கால்கள் செயல் இழந்து போனது என்றும், இதற்கு {PROC} கொண்டு அறுவை சிகிச்சை செய்ய வேண்டும் என்றும் கூறினர். இவ்வறுவை சிகிச்சைக்கு நான் என் மனப்பூர்வ சம்மதம் அளிக்கிறேன்.',
      CONSENT_ANAES_SPINE,
      CONSENT_BLOOD_SPINE,
      'மேலும், நரம்புகள் சேதம் அடைந்து கால்கள் இரண்டும் செயல் இழந்து அல்லது உணர்ச்சியின்றி போக வாய்ப்புள்ளது என அறிவேன். அறுவை சிகிச்சைக்குப் பிறகும் நரம்பு செயல்பாடு திரும்ப வராமல் போகலாம் என அறிவேன். அதனால் படுத்த படுக்கையாக இருக்கும் நிலை வரலாம் என அறிவேன். மேலும் நரம்புகள் செயல் இழந்த காரணத்தினால் சிறுநீர், மலம் கழிப்பதில் சிரமம் ஏற்படலாம். அதனால் படுத்த படுக்கையிலேயே சிறுநீர், மலம் கழிக்கும் நிலை வரலாம் என அறிவேன். மேலும் தண்டுவட நீர் கசிவு ஏற்படலாம் என அறிவேன்.',
      ...CONSENT_SPINE_TAIL('முதுகு'),
    ],
  },
};

CONSENT_TPLS.pelvis = { ...CONSENT_TPLS.lower, label: 'Pelvis / acetabulum', bone: 'இடுப்பு', paras: CONSENT_TPLS.lower.paras.map((t) => t.replace(/கால் எலும்பு/g, 'இடுப்பு எலும்பு')) };
Object.assign(CONSENT_TPLS, CONSENT_FORMS_MORE);

// Implant exit: the implant paragraph is about removing it, not fixing the bone.
const CONSENT_EXIT_RE = /IMPLANT\s*(EXIT|REMOVAL)|HARDWARE\s*REMOVAL|REMOVAL\s+OF\s+(THE\s+)?(IMPLANTS?|HARDWARE|PLATES?|NAILS?|K[\s-]?WIRES?|WIRES?|SCREWS?|TBW|PFN|DHS|ILIM|IMIL|IMN|ORTHOFIX|EX\s?FIX|EXTERNAL\s+FIXATOR|JESS)|\b(PLATES?|NAILS?|K[\s-]?WIRES?|WIRES?|SCREWS?|TBW|PFN|DHS|ILIM|IMIL|IMN|ORTHOFIX|EX\s?FIX|FIXATOR|JESS|LRS|ILIZAROV|IMPLANTS?)\s+(EXIT|REMOVAL)\b|\bROI\b/;
const consentIsExit = (c) => CONSENT_EXIT_RE.test(String(c?.plan || '').toUpperCase());
const CONSENT_EXIT_PARA = (bone) => `மேலும், எலும்பில் பொருத்திய உலோகத்தை நீக்கும் போது, அதனை முழுமையாக நீக்க இயலாத நிலை வரலாம் என அறிவேன். உலோகம் அல்லது திருகாணி உடைந்து அதன் ஒரு பகுதி எலும்பிலேயே தங்கிவிட வாய்ப்புள்ளது என அறிவேன். மேலும் உலோகத்தை நீக்கும் போதோ அல்லது நீக்கிய பின்னரோ எனது ${bone} எலும்பு உடைய வாய்ப்புள்ளது என அறிவேன். அவ்வாறு உடைந்தால் அதனைச் சரிசெய்ய மறு அறுவை சிகிச்சை செய்யும் நிலை வரலாம் என அறிவேன்.`;

// Implant exit, first paragraph: which bone was broken, what was put in, and that it now has to come out.
// {FRACTURE} and {IMPLANT} are written in Tamil; a box typed on the OT list is used as typed.
const CONSENT_EXIT_OPEN = (fracture) => `{NAME} ஆகிய நான் அரசு இராசாசி மருத்துவமனையில் அனுமதிக்கப்பட்டேன். எனக்கு ஏற்கனவே {FRACTURE}${fracture ? '' : ' எலும்பு முறிவு'} ஏற்பட்டு, அதற்கு {IMPLANT} பொருத்தி அறுவை சிகிச்சை செய்யப்பட்டது. என்னைப் பரிசோதனை செய்த மருத்துவர்கள் எலும்பில் பொருத்திய உலோகத்தை நீக்க வேண்டும் என்று கூறினர். இவ்வறுவை சிகிச்சைக்கு நான் என் மனப்பூர்வ சம்மதம் அளிக்கிறேன்.`;
// [pattern, Tamil, English in brackets]
const CONSENT_BONES = [
  [/NECK (OF )?(THE )?FEMUR|FEMORAL NECK|\bNOF\b/, 'இடுப்புப் பகுதியில் தொடை எலும்பு', 'NECK OF FEMUR'],
  [/INTER\s*TROCHANTER|\bIT (FRACTURE|FEMUR)\b/, 'இடுப்புப் பகுதியில் தொடை எலும்பு', 'INTERTROCHANTERIC'],
  [/SUB\s*TROCHANTER/, 'இடுப்புக்குக் கீழ் தொடை எலும்பு', 'SUBTROCHANTERIC'],
  [/DISTAL FEMUR|SUPRACONDYLAR (FRACTURE )?(OF )?(THE )?FEMUR/, 'முழங்காலுக்கு மேல் தொடை எலும்பு', 'DISTAL FEMUR'],
  [/FEMUR|FEMORAL/, 'தொடை எலும்பு', 'FEMUR'],
  [/TIBIAL PLATEAU|PROXIMAL TIBIA/, 'முழங்காலுக்குக் கீழ் கால் எலும்பு', 'PROXIMAL TIBIA'],
  [/PILON|PLAFOND|DISTAL TIBIA/, 'கணுக்காலுக்கு மேல் கால் எலும்பு', 'DISTAL TIBIA'],
  [/BOTH BONES?( OF)?( THE)? LEG|\bBBFL\b/, 'காலின் இரண்டு எலும்புகளிலும்', 'BOTH BONES LEG'],
  [/TIBIA/, 'கால் முன்னெலும்பு', 'TIBIA'],
  [/MALLEOL|ANKLE/, 'கணுக்கால் எலும்பு', 'ANKLE'],
  [/FIBULA/, 'கால் வெளி எலும்பு', 'FIBULA'],
  [/PATELLA/, 'முழங்கால் சில்லு எலும்பு', 'PATELLA'],
  [/CALCAN/, 'குதிகால் எலும்பு', 'CALCANEUM'],
  [/METATARSAL/, 'பாத எலும்பு', 'METATARSAL'],
  [/ACETABUL/, 'இடுப்புக் கிண்ண எலும்பு', 'ACETABULUM'],
  [/PELVI/, 'இடுப்பு எலும்பு', 'PELVIS'],
  [/CLAVICLE/, 'காறை எலும்பு', 'CLAVICLE'],
  [/PROXIMAL HUMER|SURGICAL NECK/, 'தோள்பட்டை அருகே மேற்கை எலும்பு', 'PROXIMAL HUMERUS'],
  [/DISTAL HUMER|SUPRACONDYLAR (FRACTURE )?(OF )?(THE )?HUMER|INTERCONDYLAR/, 'முழங்கைக்கு மேல் மேற்கை எலும்பு', 'DISTAL HUMERUS'],
  [/HUMER/, 'மேற்கை எலும்பு', 'HUMERUS'],
  [/OLECRANON/, 'முழங்கை எலும்பு', 'OLECRANON'],
  [/BOTH BONES?( OF)?( THE)? FOREARM|\bBBFA\b/, 'முன்கையின் இரண்டு எலும்புகளிலும்', 'BOTH BONES FOREARM'],
  [/DISTAL RADIUS|DISTAL END (OF )?RADIUS|COLLES|SMITH|BARTON/, 'மணிக்கட்டு அருகே முன்கை எலும்பு', 'DISTAL RADIUS'],
  [/RADIUS|RADIAL/, 'முன்கை எலும்பு', 'RADIUS'],
  [/ULNA/, 'முன்கை எலும்பு', 'ULNA'],
  [/METACARPAL/, 'உள்ளங்கை எலும்பு', 'METACARPAL'],
  [/SCAPHOID/, 'மணிக்கட்டு எலும்பு', 'SCAPHOID'],
  [/\bHIP\b/, 'இடுப்புப் பகுதியில் தொடை எலும்பு', 'HIP'],
];
const consentSideTa = (t) => (/\b(BILATERAL|B\/L)\b/.test(t) ? 'இரண்டு பக்க ' : /\b(LEFT|LT)\b/.test(t) ? 'இடது ' : /\b(RIGHT|RT)\b/.test(t) ? 'வலது ' : '');
// e.g. "வலது தொடை எலும்பு (FEMUR) முறிவு"
function consentExitBone(c) {
  if (String(c.exitBone || '').trim()) return c.exitBone;
  const dx = String(c.diagnosis || '').toUpperCase();
  const vert = /\b([CDTL])(\d{1,2})\b/.exec(dx);
  if (vert) return `${vert[1] === 'C' ? 'கழுத்து' : 'முதுகுத்தண்டு'} எலும்பு (${vert[0]}) முறிவு`;
  const hit = CONSENT_BONES.find(([re]) => re.test(dx));
  if (!hit) return '';
  const [, ta, en] = hit;
  return `${consentSideTa(dx)}${ta} (${en}) முறிவு`;
}
// The unit's words: உள்புறக் கம்பி (nail, rod, K-wire), வெளிப்புறக் கம்பி (ex-fix), திருகாணி (screw),
// உலோகத்தினால் ஆன செயற்கை மூட்டு (arthroplasty), தகடு (plate).
const CONSENT_IMPLANT_PARTS = [
  ['joint', /ARTHROPLASTY|BIPOLAR|AUSTIN MOORE|\bAMP\b|THOMPSON|\bTHR\b|\bTKR\b|TOTAL HIP|TOTAL KNEE|PROSTHES/, 'உலோகத்தினால் ஆன செயற்கை மூட்டு'],
  ['ring', /ILIZAROV|RING FIXATOR|CIRCULAR FIXATOR|\bTSF\b|TAYLOR SPATIAL/, 'வெளிப்புற வளையக் கம்பி'],
  ['exfix', /EX\s?FIX|EXTERNAL FIXATOR|ORTHOFIX|\bJESS\b|\bLRS\b|LIMB RECONSTRUCTION|RAIL FIXATOR|FIXATOR/, 'வெளிப்புறக் கம்பி'],
  ['plate', /PLATE|PLATING|\bLCP\b|\bDCP\b|\bDHS\b|\bDCS\b|DYNAMIC HIP/, 'தகடு'],
  ['rod', /NAIL|ILIM|IMIL|\bIMN\b|\bPFNA?\b|\bTENS\b|INTRAMEDULLARY|\bRODS?\b|K[\s-]?WIRE|\bTBW\b|TENSION BAND|\bWIRES?\b|PEDICLE|\bPSF\b/, 'உள்புறக் கம்பி'],
  ['screw', /SCREW|\bCC\b|CANNULATED|PLATE|PLATING|\bLCP\b|\bDCP\b|\bDHS\b|\bDCS\b|\bPFNA?\b|ILIM|IMIL|INTERLOCK|PEDICLE|\bPSF\b|BOLT/, 'திருகாணி'],
];
function consentExitFracture(c) {
  if (String(c.exitBone || '').trim()) return `${c.exitBone.trim()}${/முறிவு\s*$/.test(c.exitBone) ? '' : ' எலும்பு முறிவு'}`;
  return consentExitBone(c);
}
// The implant in the unit's Tamil words, from the first text that names one.
function consentImplantTa(...texts) {
  for (const t of texts) {
    const u = String(t || '').toUpperCase();
    let hits = CONSENT_IMPLANT_PARTS.filter(([, re]) => re.test(u));
    if (hits.some(([k]) => k === 'ring')) hits = hits.filter(([k]) => k !== 'exfix' && k !== 'rod'); // Ilizarov wires are part of the frame
    const parts = hits.map(([, , ta]) => ta);
    if (parts.length) return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} மற்றும் ${parts.at(-1)}`;
  }
  return '';
}
const consentTyped = (c) => String(c.consentImplant || c.exitImplant || '').trim();
// Implant exit: what is in the bone now.
function consentExitImplant(c) {
  return consentTyped(c) || consentImplantTa(c.plan, c.diagnosis, c.implants);
}
// Every other form: what the operation will use ("____ கொண்டு அறுவை சிகிச்சை"); the plan as written
// if it names no implant (e.g. debridement).
function consentProcImplant(c) {
  return consentTyped(c) || consentImplantTa(c.plan, c.implants) || c.plan || '';
}

// Which form: chosen on the OT list (c.consentTpl), else from the diagnosis, then the plan.
const CONSENT_RE = {
  cervical: /CERVICAL|\bC[1-7](\s*[-–/]\s*C?[1-7])?\b|ODONTOID|\bDENS\b|ATLAS|\bAXIS\b|HANGMAN|JEFFERSON|\bACDF\b|LATERAL MASS|OCCIPITO/,
  spine: /SPINE|SPINAL|VERTEBRA|DORSAL|THORACIC|LUMBAR|THORACOLUMBAR|DORSOLUMBAR|\b[DTL]\s?\d{1,2}\b|BURST|CHANCE|PEDICLE|LAMINECTOMY|\bPSF\b|TLIF|PLIF|SPONDYL|POTT|PARAPLEGI|PARAPARESIS|\bSCI\b/,
  upper: /CLAVICLE|SHOULDER|HUMER|ELBOW|OLECRANON|CORONOID|RADIUS|RADIAL|ULNA|FOREARM|WRIST|SCAPHOID|CARPAL|METACARPAL|HAND|FINGER|THUMB|MONTEGGIA|GALEAZZI|COLLES|SMITH|BARTON|SCAPULA|ACROMIO|\bAC JOINT|BENNETT|BOXER|UPPER LIMB|\bBBFA\b|\bDER\b|SUPRACONDYLAR HUMER/,
  lower: /FEMUR|FEMORAL|\bNOF\b|TROCHANTER|\bHIP\b|ACETABUL|PELVI|TIBIA|TIBIAL|FIBULA|PLATEAU|PILON|PLAFOND|KNEE|PATELLA|ANKLE|MALLEOL|BIMALLEOLAR|TRIMALLEOLAR|FOOT|CALCAN|TALUS|TALAR|LISFRANC|METATARSAL|\bTOE|\bLEG\b|LOWER LIMB|\bBBFL\b/,
};
// Procedure-specific risks, added before the closing "not responsible" paragraph (not for implant removal).
const CONSENT_EXTRA = {
  pelvis: 'மேலும், இடுப்பு எலும்பு அறுவை சிகிச்சையின் போது இடுப்பு மற்றும் வயிற்றுப் பகுதியில் உள்ள உறுப்புகளான சிறுநீர்ப்பை, சிறுநீர்க் குழாய், குடல், பிறப்பு உறுப்புகள் மற்றும் பெரிய இரத்த நாளங்கள், நரம்புகள் (சியாட்டிக் நரம்பு) சேதம் அடைய வாய்ப்புள்ளது என அறிவேன். அதனால் அதிக இரத்தப் போக்கு, சிறுநீர் மற்றும் மலம் கழிப்பதில் சிரமம், காலில் உணர்ச்சியின்மை அல்லது செயல் இழப்பு ஏற்படலாம் என அறிவேன். அவற்றைச் சரிசெய்ய வேறு துறை மருத்துவர்களின் உதவியுடன் கூடுதல் அறுவை சிகிச்சை செய்யும் நிலை வரலாம் என அறிவேன்.',
  arthroplasty: 'மேலும், உலோகத்தினால் ஆன செயற்கை மூட்டு பொருத்திய பின்னர் காலின் நீளம் குறைந்தோ அல்லது கூடியோ (கால் நீள வேறுபாடு) போக வாய்ப்புள்ளது என அறிவேன். செயற்கை மூட்டு இடம் விலகுதல் (Dislocation), தளர்ந்து போதல் (Loosening), மூட்டு இறுக்கம், செயற்கை மூட்டைச் சுற்றியுள்ள எலும்பு உடைதல் போன்றவை ஏற்படலாம் என அறிவேன். கிருமி தொற்று ஏற்பட்டால் செயற்கை மூட்டை அகற்றி மறு அறுவை சிகிச்சை செய்யும் நிலை வரலாம் என அறிவேன்.',
  spine: (limbs) => `மேலும், தண்டுவடத்தைச் சுற்றியுள்ள சவ்வு (Dura) கிழிந்து தண்டுவட நீர் (CSF) கசிவு ஏற்படலாம் என்றும், அதனைச் சரிசெய்ய மறு அறுவை சிகிச்சை தேவைப்படலாம் என்றும் அறிவேன். மேலும் தண்டுவடம் அல்லது நரம்பு வேர்களுக்குக் காயம் ஏற்பட்டு ${limbs} செயல் இழப்பு மேலும் அதிகரிக்கவோ, புதிதாக ஏற்படவோ வாய்ப்புள்ளது என அறிவேன்.`,
};
// More procedure-specific risks (first two that apply, so the form stays on one page).
const CONSENT_MORE = [
  ['open', /COMPOUND|OPEN\s+(GRADE|FRACTURE|INJURY)|GRADE\s*(I{1,3}|[123])\s*[ABC]?\b|GUSTILO|DEBRIDEMENT/, (limbAcc) => `மேலும், திறந்த காயத்துடன் கூடிய எலும்பு முறிவு என்பதால் கிருமி தொற்று ஏற்படும் வாய்ப்பு அதிகம் என்றும், புண்ணைச் சுத்தம் செய்ய பலமுறை அறுவை சிகிச்சை (Debridement), தோல் ஒட்டுதல் (Skin graft / Flap) தேவைப்படலாம் என்றும், மிகத் தீவிரமான நிலையில் ${limbAcc} துண்டித்து அகற்றும் நிலை வரலாம் என்றும் அறிவேன்.`],
  ['child', null, (limb) => `மேலும், எலும்பு வளர்ச்சிப் பகுதி (Growth plate) பாதிக்கப்பட்டு, வளர்ச்சியின் போது ${limb} நீளம் குறைதல் அல்லது வளைதல் (Deformity) ஏற்படலாம் என்றும், பொருத்திய கம்பிகளை அகற்ற மறு அறுவை சிகிச்சை தேவைப்படும் என்றும் அறிவேன்.`],
  ['hip', /NECK\s+(OF\s+)?(THE\s+)?FEMUR|\bNOF\b|TROCHANTER|\bHIP\b/, (nof) => `மேலும், இடுப்பு எலும்பு முறிவினால் நீண்ட நாட்கள் படுக்கையில் இருப்பதால் காலில் இரத்தம் கட்டுதல் (DVT), நுரையீரலில் இரத்தக் கட்டி அடைப்பு, நிமோனியா, படுக்கைப் புண் போன்றவை ஏற்படலாம் என அறிவேன்.${nof ? ' மேலும் தொடை எலும்பின் தலைப் பகுதிக்கு இரத்த ஓட்டம் குறைந்து (AVN) எலும்பு அழுகவோ கூடாமல் போகவோ வாய்ப்புள்ளது என்றும், அப்போது செயற்கை மூட்டு பொருத்தும் நிலை வரலாம் என்றும் அறிவேன்.' : ''}`],
  ['nail', /\bIMIL\b|\bILN\b|\bNAIL|\bPFN|INTERLOCK/, () => 'மேலும், உள்புறக் கம்பி பொருத்தும் போது எலும்பு மஜ்ஜையில் உள்ள கொழுப்புத் துகள்கள் இரத்தத்தில் கலந்து நுரையீரலை அடைத்து (Fat embolism) மூச்சுத்திணறல் ஏற்பட்டு உயிருக்கு ஆபத்து வரலாம் என அறிவேன். மேலும் எலும்பு சுழன்று கூடுதல் (Malrotation), கம்பி செலுத்திய இடத்தில் வலி, பூட்டு திருகாணிகள் உடைதல் போன்றவை ஏற்படலாம் என அறிவேன்.'],
  ['exfix', /EX\s*-?\s*FIX|EXTERNAL\s+FIXAT|\bLRS\b|ILIZAROV|\bJESS\b/, () => 'மேலும், வெளிப்புறக் கம்பி பொருத்திய இடங்களில் கிருமி தொற்று (Pin tract infection), கம்பி தளர்தல் ஏற்படலாம் என்றும், அதற்குக் கம்பிகளைத் தினமும் சுத்தம் செய்து பராமரிக்க வேண்டும் என்றும், பின்னர் வேறு அறுவை சிகிச்சை தேவைப்படலாம் என்றும் அறிவேன்.'],
  ['clavicle', /CLAVIC/, () => 'மேலும், கழுத்துப் பட்டை எலும்பின் கீழ் உள்ள பெரிய இரத்த நாளங்கள், கை நரம்புகள் (Brachial plexus) மற்றும் நுரையீரல் சேதம் அடைந்து அதிக இரத்தப் போக்கு, கை செயல் இழப்பு, நுரையீரலில் காற்றுக் கசிவு (Pneumothorax) ஏற்படலாம் என அறிவேன்.'],
  ['armNerve', /HUMER|SUPRACONDYLAR|ELBOW|FOREARM|\bRADIUS\b|\bULNA\b|MONTEGGIA|GALEAZZI/, () => 'மேலும், அறுவை சிகிச்சையின் போது கையின் நரம்புகள் (ரேடியல், அல்நார், மீடியன் நரம்பு) சேதம் அடைந்து மணிக்கட்டு, விரல்கள் செயல் இழக்கவோ (Wrist drop) உணர்ச்சியற்றுப் போகவோ வாய்ப்புள்ளது என்றும், அது சரியாகப் பல மாதங்கள் ஆகலாம் என்றும் அறிவேன்.'],
  ['peroneal', /PLATEAU|PROXIMAL\s+(TIBIA|FIBULA)|KNEE\s+DISLOCATION/, () => 'மேலும், முழங்காலுக்குக் கீழ் உள்ள நரம்பு (Common peroneal nerve) சேதம் அடைந்து பாதத்தைத் தூக்க இயலாமை (Foot drop) ஏற்படலாம் என அறிவேன்.'],
  ['compartment', /TIBIA|\bLEG\b|FOREARM|BOTH\s+BONES?/, () => 'மேலும், அறுவை சிகிச்சைக்குப் பின்னர் தசைப் பகுதியில் அழுத்தம் அதிகரித்து (Compartment syndrome) இரத்த ஓட்டம் பாதிக்கப்படலாம் என்றும், அதற்கு அவசரமாகத் தோலைக் கீறி அழுத்தத்தைக் குறைக்கும் அறுவை சிகிச்சை (Fasciotomy) தேவைப்படலாம் என்றும் அறிவேன்.'],
  ['joint', /PLATEAU|PILON|PLAFOND|INTRA[\s-]?ARTICULAR|CONDYL|DISTAL\s+(END\s+)?(OF\s+)?RADIUS|\bDER\b|COLLES|BARTON|MALLEOL|OLECRANON|PATELLA|CALCAN|ELBOW|RADIAL\s+HEAD|PROXIMAL\s+HUMERUS|SHOULDER|LISFRANC|TALUS/, () => 'மேலும், மூட்டைச் சுற்றியுள்ள எலும்பு முறிவு என்பதால் அறுவை சிகிச்சைக்குப் பின்னரும் மூட்டு இறுக்கம், மூட்டு அசைவு குறைதல், நாளடைவில் மூட்டுத் தேய்மானம் (Arthritis) ஏற்படலாம் என்றும், அதற்கு நீண்ட நாட்கள் இயன்முறை சிகிச்சை (Physiotherapy) தேவைப்படும் என்றும் அறிவேன்.'],
  ['scope', /ARTHROSCOP|\bACL\b|\bPCL\b|MENISC|BANKART|ROTATOR\s+CUFF|LIGAMENT\s+RECONSTRUCTION|\bMPFL\b|LATARJET/, () => 'மேலும், சவ்வு / தசைநார் சீரமைப்புக்குப் பின்னர் மூட்டு இறுக்கம், மூட்டில் நீர் அல்லது இரத்தம் சேர்தல், ஒட்டிய தசைநார் தளர்தல் அல்லது மீண்டும் கிழிதல் ஏற்படலாம் என்றும், நீண்ட நாட்கள் இயன்முறை சிகிச்சை (Physiotherapy) தேவைப்படும் என்றும் அறிவேன்.'],
  ['tumour', /TUMOU?R|\bGCT\b|GIANT\s+CELL|SARCOMA|CHONDROMA|EXOSTOSIS|BONE\s+CYST|\bABC\b|METASTA|MYELOMA|OSTEOID|EWING|LIPOMA|NEOPLASM|LYTIC|CURETTAGE|EXCISION\s+BIOPSY|WIDE\s+EXCISION|MEGAPROSTHESIS/, () => 'மேலும், கட்டியை முழுமையாக அகற்ற இயலாத நிலை வரலாம் என்றும், அகற்றிய பின்னரும் கட்டி மீண்டும் வர (Recurrence) வாய்ப்புள்ளது என்றும், அகற்றிய திசு பரிசோதனைக்கு (HPE) அனுப்பப்படும் என்றும், அதன் முடிவைப் பொறுத்து மேலும் சிகிச்சை (கீமோதெரபி / கதிர்வீச்சு / மறு அறுவை சிகிச்சை) தேவைப்படலாம் என்றும் அறிவேன்.'],
];
// the order they are picked in (most important first)
const CONSENT_MORE_ORDER = ['tumour', 'open', 'child', 'hip', 'clavicle', 'nail', 'exfix', 'armNerve', 'peroneal', 'compartment', 'joint', 'scope'];
const CONSENT_ARTHROPLASTY_RE = /ARTHROPLASTY|BIPOLAR|AUSTIN\s*MOORE|\bAMP\b|THOMPSON|\bTHR\b|\bTHA\b|\bTKR\b|\bTKA\b|\bUKR\b|TOTAL\s+(HIP|KNEE)|PROSTHE(SIS|TIC)|REPLACEMENT/;
function consentExtras(c, kind) {
  if (consentIsExit(c)) return [];
  if (kind === 'cervical') return [CONSENT_EXTRA.spine('கைகள், கால்கள்')];
  if (kind === 'dorsolumbar') return [CONSENT_EXTRA.spine('கால்கள்')];
  if (kind === 'arthroplasty' || kind === 'arthroscopy' || kind === 'paeds') return []; // these forms already say it
  const out = [];
  const plan = String(`${c?.plan || ''} ${c?.procedureDone || ''}`).toUpperCase();
  const all = String(`${c?.diagnosis || ''} ${plan}`).toUpperCase();
  const arthro = CONSENT_ARTHROPLASTY_RE.test(plan);
  if (kind === 'pelvis' || (kind === 'lower' && consentPelvic(c))) out.push(CONSENT_EXTRA.pelvis);
  if (arthro) out.push(CONSENT_EXTRA.arthroplasty);
  const upper = kind === 'upper';
  const limb = upper ? 'கை' : 'கால்';
  const limbAcc = upper ? 'கையைத்' : 'காலைத்';
  const age = parseFloat(String(c?.age ?? ''));
  const by = Object.fromEntries(CONSENT_MORE.map((x) => [x[0], x]));
  for (const k of CONSENT_MORE_ORDER) {
    if (out.length >= 2) break;
    const [, re, text] = by[k];
    if (k === 'child') { if (age < 15 && !consentPelvic(c)) out.push(text(limb)); continue; }
    if (!re.test(all)) continue;
    if (k === 'hip' && (kind !== 'lower' || consentPelvic(c))) continue;
    if (k === 'nail' && arthro) continue;
    if (k === 'armNerve' && !upper) continue;
    if (k === 'compartment' && /HUMER|ELBOW/.test(all) && !/FOREARM|BOTH\s+BONES?/.test(all)) continue;
    if (k === 'open' && /OPEN\s+(BOOK|REDUCTION)/.test(all) && !/COMPOUND|GRADE|GUSTILO|OPEN\s+(FRACTURE|INJURY)/.test(all)) continue;
    out.push(k === 'open' ? text(limbAcc) : k === 'hip' ? text(/NECK\s+(OF\s+)?(THE\s+)?FEMUR|\bNOF\b/.test(all) && !arthro) : text());
  }
  return out;
}
const consentPelvic = (c) => /PELVI|ACETABUL|\bILIUM\b|ILIAC WING|PUBIC RAMI|PUBIC RAMUS|SACRO\s*ILIAC|\bSI JOINT\b|SYMPHYSIS/.test(String(`${c?.diagnosis || ''} ${c?.plan || ''}`).toUpperCase());
const CONSENT_SCOPE_RE = /ARTHROSCOP|\bACL\b|\bPCL\b|CRUCIATE|MENISC|BANKART|ROTATOR CUFF|LABRAL|\bSLAP\b|\bMPFL\b|LATARJET|LIGAMENT RECONSTRUCTION/;
const CONSENT_PAEDS_RE = /CTEV|CLUB ?FOOT|TENOTOMY|\bPMSTR\b|POSTERO ?MEDIAL (SOFT TISSUE )?RELEASE|QUADRICEPS ?PLASTY|QUADRICEPSPLASTY|JUDET|CEREBRAL PALSY|CONTRACTURE|SOFT TISSUE RELEASE|TENDON (LENGTHENING|TRANSFER)|\bTAL\b|DDH|PERTHES|\bSCFE\b|GUIDED GROWTH|HEMIEPIPHYSIODESIS|ARTHROGRYPOSIS|CONGENITAL/;
function consentKind(c) {
  if (c && CONSENT_TPLS[c.consentTpl]) return c.consentTpl;
  {
    const dx = String(c?.diagnosis || '').toUpperCase();
    const pl = String(`${c?.plan || ''} ${c?.procedureDone || ''}`).toUpperCase();
    const all = `${dx} ${pl}`;
    const fracture = /FRACTURE|#|DISLOCATION|INJURY|TRAUMA/.test(dx);
    if (!consentIsExit(c)) {
      if (!fracture && CONSENT_ARTHROPLASTY_RE.test(pl)) return 'arthroplasty';
      if (CONSENT_SCOPE_RE.test(all) && !/FRACTURE/.test(dx)) return 'arthroscopy';
      if (!fracture && CONSENT_PAEDS_RE.test(all)) return 'paeds';
    }
    if (consentPelvic(c) && !CONSENT_RE.cervical.test(dx) && !CONSENT_RE.spine.test(dx)) return 'pelvis';
  }
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
  const t = String(`${c.consentImplant || ''} ${c.implants || ''} ${c.plan || ''}`).toUpperCase();
  return /SCREW|திருகாணி|\bPSF\b|PEDICLE|POSTERIOR STABILI[SZ]ATION|\bTLIF\b|\bPLIF\b|\bACDF\b|ANTERIOR CERVICAL|LATERAL MASS|FIXATION/.test(t) ? 'திருகாணி' : '';
}

// ---- Patient's name in Tamil script: c.nameTa if typed on the OT list, else a phonetic guess.
const TA_V = { a: ['அ', ''], aa: ['ஆ', 'ா'], i: ['இ', 'ி'], ii: ['ஈ', 'ீ'], ee: ['ஈ', 'ீ'], u: ['உ', 'ு'], uu: ['ஊ', 'ூ'], oo: ['ஊ', 'ூ'],
  e: ['எ', 'ெ'], E: ['ஏ', 'ே'], ae: ['ஏ', 'ே'], ai: ['ஐ', 'ை'], ay: ['ஐ', 'ை'], o: ['ஒ', 'ொ'], O: ['ஓ', 'ோ'], au: ['ஔ', 'ௌ'], ou: ['ஔ', 'ௌ'] };
const TA_C = [['ksh', 'க்ஷ'], ['sh', 'ஷ'], ['ch', 'ச'], ['th', 'த'], ['dh', 'த'], ['zh', 'ழ'], ['kh', 'க'], ['gh', 'க'], ['bh', 'ப'], ['ph', 'ப'], ['jh', 'ஜ'],
  ['k', 'க'], ['g', 'க'], ['c', 'க'], ['j', 'ஜ'], ['t', 'ட'], ['d', 'ட'], ['n', 'ன'], ['m', 'ம'], ['p', 'ப'], ['b', 'ப'], ['y', 'ய'], ['r', 'ர'],
  ['l', 'ல'], ['v', 'வ'], ['w', 'வ'], ['s', 'ச'], ['h', 'ஹ'], ['f', 'ப'], ['z', 'ஜ'], ['x', 'க்ஸ'], ['q', 'க']];
const TA_LETTER = { A: 'ஏ', B: 'பி', C: 'சி', D: 'டி', E: 'ஈ', F: 'எஃப்', G: 'ஜி', H: 'ஹெச்', I: 'ஐ', J: 'ஜே', K: 'கே', L: 'எல்', M: 'எம்', N: 'என்', O: 'ஓ',
  P: 'பி', Q: 'க்யூ', R: 'ஆர்', S: 'எஸ்', T: 'டி', U: 'யு', V: 'வி', W: 'டபிள்யு', X: 'எக்ஸ்', Y: 'ஒய்', Z: 'இசட்' };
function taWord(w, { initial = true, end = true } = {}) {
  if (initial && /^[A-Z]$/i.test(w)) return TA_LETTER[w.toUpperCase()] + '.'; // initials
  if (/^(sri|shri|sree)$/i.test(w)) return 'ஸ்ரீ';
  const s = w.toLowerCase().replace(/[^a-z]/g, '').replace(/i(?=[aou])/g, 'iy');
  const isV = (ch) => /[aeiou]/.test(ch || '');
  let out = '';
  let i = 0;
  let cons = null; // pending consonant (Tamil) waiting for its vowel
  const flush = () => { if (cons) { out += cons + '்'; cons = null; } };
  while (i < s.length) {
    // vowel?
    let v = ['aa', 'ai', 'ay', 'au', 'ou', 'ee', 'ii', 'oo', 'uu', 'ae'].find((x) => s.startsWith(x, i) && !(x === 'ay' && isV(s[i + 2])));
    if (!v && isV(s[i])) {
      v = s[i];
      // e / o: long before a single consonant, short before a cluster
      if (v === 'e' || v === 'o') {
        const rest = s.slice(i + 1);
        const c1 = TA_C.find(([k]) => rest.startsWith(k));
        const after = c1 ? rest.slice(c1[0].length) : rest;
        const cluster = c1 && after && !isV(after[0]) && after[0] !== 'y';
        v = cluster ? v : v.toUpperCase();
      }
      if (v === 'a' && i === s.length - 1 && cons && end) v = 'aa'; // final -a is long (GEETHA → கீதா)
    }
    if (!v && s[i] === 'y' && cons && !isV(s[i + 1])) v = 'i'; // SAMY → சாமி
    if (v) {
      const len = v.length === 2 ? 2 : 1;
      out += cons ? cons + TA_V[v][1] : TA_V[v][0];
      cons = null;
      i += len;
      continue;
    }
    // consonant
    flush();
    let [k, ta] = TA_C.find(([x]) => s.startsWith(x, i));
    const next = s.slice(i + k.length);
    if (k === 'n') {
      if (i === 0) ta = 'ந';
      else if (/^(th|dh)/.test(next)) ta = 'ந';
      else if (/^d/.test(next)) ta = 'ந';
      else if (/^t/.test(next)) ta = 'ண';
      else if (/^[kg]/.test(next)) ta = 'ங';
      else if (/^[jc]/.test(next)) ta = 'ஞ';
    }
    if (k === 'd' && (i === 0 || /n$/.test(s.slice(0, i)))) ta = 'த';
    if ((k === 'j' || k === 'ch') && /n$/.test(s.slice(0, i))) ta = 'ச';
    if (k === 's' && i === 0 && !isV(next[0]) && next[0] !== 'h') ta = 'ஸ'; // SRINIVASAN
    cons = ta;
    i += k.length;
  }
  flush();
  return out;
}
// Common Tamil name parts, spelt as in Tamil (phonetics alone can't know ண / ள / long vowels).
const TA_NAMES = {
  AMMAL: 'அம்மாள்', AMMA: 'அம்மா', APPAN: 'அப்பன்', SAMY: 'சாமி', SAMI: 'சாமி', SWAMY: 'சுவாமி', SWAMI: 'சுவாமி', KUMAR: 'குமார்', KUMARI: 'குமாரி',
  LAKSHMI: 'லட்சுமி', LAKSMI: 'லட்சுமி', LATCHUMI: 'லட்சுமி', MEENAKSHI: 'மீனாட்சி', MEENATCHI: 'மீனாட்சி', VALLI: 'வள்ளி', DEVI: 'தேவி', RANI: 'ராணி', VANI: 'வாணி',
  SELVAM: 'செல்வம்', SELVI: 'செல்வி', SELVA: 'செல்வ', PONNU: 'பொன்னு', PON: 'பொன்', CHINNA: 'சின்ன', PERIYA: 'பெரிய', MUNI: 'முனி', KALI: 'காளி', MARI: 'மாரி',
  MURUGAN: 'முருகன்', MURUGESAN: 'முருகேசன்', ARUMUGAM: 'ஆறுமுகம்', SARAVANAN: 'சரவணன்', SARAVANA: 'சரவண', PERUMAL: 'பெருமாள்', KANNAN: 'கண்ணன்', KANNA: 'கண்ண',
  KARTHIK: 'கார்த்திக்', KARTHIKEYAN: 'கார்த்திகேயன்', KARTHIKA: 'கார்த்திகா', MUTHU: 'முத்து', PANDI: 'பாண்டி', PANDIAN: 'பாண்டியன்', PANDIYAN: 'பாண்டியன்',
  GANESH: 'கணேஷ்', GANESAN: 'கணேசன்', RAJA: 'ராஜா', RAJ: 'ராஜ்', RAJAN: 'ராஜன்', RAJU: 'ராஜு', RAMAN: 'ராமன்', RAMU: 'ராமு', RAMESH: 'ரமேஷ்', RAMASAMY: 'ராமசாமி',
  BALU: 'பாலு', BALA: 'பாலா', GOPAL: 'கோபால்', ANAND: 'ஆனந்த்', ANANDH: 'ஆனந்த்', ANANDAN: 'ஆனந்தன்', SUNDAR: 'சுந்தர்', SUNDARAM: 'சுந்தரம்', SUNDARI: 'சுந்தரி',
  SUBRAMANI: 'சுப்பிரமணி', SUBRAMANIAN: 'சுப்பிரமணியன்', SUBRAMANIYAN: 'சுப்பிரமணியன்', MANI: 'மணி', MANIKANDAN: 'மணிகண்டன்', SRINIVASAN: 'சீனிவாசன்', SEENIVASAN: 'சீனிவாசன்',
  KRISHNAN: 'கிருஷ்ணன்', KRISHNA: 'கிருஷ்ணா', KRISHNAVENI: 'கிருஷ்ணவேணி', CHANDRAN: 'சந்திரன்', CHANDRA: 'சந்திரா', SANTHI: 'சாந்தி', SHANTHI: 'சாந்தி', LATHA: 'லதா',
  GEETHA: 'கீதா', SUDHA: 'சுதா', VIJAYA: 'விஜயா', VIJAY: 'விஜய்', PRIYA: 'பிரியா', DHANA: 'தன', DHANAM: 'தனம்', KAMALA: 'கமலா', KANNAMMA: 'கண்ணம்மா', PANDIAMMAL: 'பாண்டியம்மாள்',
  VELU: 'வேலு', VEL: 'வேல்', SEKAR: 'சேகர்', SEKARAN: 'சேகரன்', MOORTHY: 'மூர்த்தி', MURTHY: 'மூர்த்தி', NATHAN: 'நாதன்', VEERA: 'வீர', VEERAN: 'வீரன்', KARUPPU: 'கருப்பு',
  KARUPPASAMY: 'கருப்பசாமி', KARUPPAIAH: 'கருப்பையா', AIAH: 'ையா', IAH: 'ையா', AYYA: 'ையா', IYA: 'ையா', SIVA: 'சிவ', SIVAN: 'சிவன்', SAKTHI: 'சக்தி', SHAKTHI: 'சக்தி',
  JOTHI: 'ஜோதி', JYOTHI: 'ஜோதி', MAHESWARI: 'மகேஸ்வரி', ESWARI: 'ஈஸ்வரி', ESWARAN: 'ஈஸ்வரன்', PARVATHI: 'பார்வதி', SAROJA: 'சரோஜா', VASANTHA: 'வசந்தா', VASANTHI: 'வசந்தி',
  ALAGU: 'அழகு', AZHAGU: 'அழகு', ALAGAR: 'அழகர்', PANCHAVARNAM: 'பஞ்சவர்ணம்', POOJA: 'பூஜா', MOHAN: 'மோகன்', MADHAVAN: 'மாதவன்', NAGARAJ: 'நாகராஜ்', NAGARAJAN: 'நாகராஜன்',
  GOVINDAN: 'கோவிந்தன்', GOVINDARAJ: 'கோவிந்தராஜ்', ARUN: 'அருண்', ARUNA: 'அருணா', KAVITHA: 'கவிதா', DEEPA: 'தீபா', ANBU: 'அன்பு', ANBALAGAN: 'அன்பழகன்', THANGAM: 'தங்கம்',
  THANGA: 'தங்க', JOHN: 'ஜான்', MARY: 'மேரி', JOSEPH: 'ஜோசப்', ABDUL: 'அப்துல்', RAHMAN: 'ரஹ்மான்', MOHAMMED: 'முகமது', MOHAMED: 'முகமது', MUHAMMAD: 'முகமது', OF: 'ஆஃப்', MUTHAIAH: 'முத்தையா', MUTHUKUMAR: 'முத்துக்குமார்', SUGUNA: 'சுகுணா', JAYA: 'ஜெயா', JAYAKUMAR: 'ஜெயக்குமார்', RAMAIAH: 'ராமையா', BABY: 'பேபி', BABU: 'பாபு',
};
// Split a word into known parts (fewest letters left to guess), guess the rest phonetically.
function taNameWord(w) {
  if (/^[A-Z]$/i.test(w)) return taWord(w);
  const s = w.toUpperCase().replace(/[^A-Z]/g, '');
  if (!s) return '';
  const n = s.length;
  const best = Array(n + 1).fill(null);
  best[0] = { cost: 0, parts: [] };
  for (let i = 0; i < n; i++) {
    if (!best[i]) continue;
    for (let j = n; j > i; j--) {
      const piece = s.slice(i, j);
      const known = TA_NAMES[piece];
      const cost = best[i].cost + (known ? 0 : j - i);
      if (known === undefined && j - i > 1) continue; // unknown text goes one letter at a time
      if (!best[j] || cost < best[j].cost) best[j] = { cost, parts: [...best[i].parts, known ? { ta: known } : { en: piece }] };
    }
  }
  // merge the guessed letters into runs and convert each run
  const runs = [];
  for (const p of best[n].parts) {
    if (p.en && runs.length && runs.at(-1).en !== undefined) runs.at(-1).en += p.en;
    else runs.push({ ...p });
  }
  let out = '';
  runs.forEach((r, k) => {
    let ta = r.ta ?? taWord(r.en, { initial: false, end: k === runs.length - 1 });
    // joining: a part starting with a vowel after one ending in a vowel sign (காளி + அம்மாள் → காளியம்மாள்)
    const V = { 'அ': '', 'ஆ': 'ா', 'இ': 'ி', 'ஈ': 'ீ', 'உ': 'ு', 'ஊ': 'ூ', 'எ': 'ெ', 'ஏ': 'ே', 'ஐ': 'ை', 'ஒ': 'ொ', 'ஓ': 'ோ' };
    if (out && V[ta[0]] !== undefined && /்$/.test(out)) { out = out.slice(0, -1); ta = V[ta[0]] + ta.slice(1); } // வீர் + அம்மாள் → வீரம்மாள்
    else if (out && V[ta[0]] !== undefined) ta = 'ய' + V[ta[0]] + ta.slice(1);
    else if (out && /^[ாிீுூெேைொோ]/.test(ta) && /்$/.test(out)) out = out.slice(0, -1); // "ையா" after a consonant
    else if (out && /^[ாிீுூெேைொோ]/.test(ta)) ta = 'ய' + ta;
    out += ta;
  });
  return out;
}
const taName = (name) => String(name || '').trim().split(/[\s.]+/).filter(Boolean).map(taNameWord).join(' ');
const consentNameTa = (c) => String(c.nameTa || '').trim() || taName(c.name);

// Under 18: the parent signs for "எனது மகனுக்கு / மகளுக்கு", and the patient's parts become அவன் / அவள்.
const consentMinor = (c) => c?.minor === true || ageYears(c) < 18;
function consentForChild(text, sex) {
  const P = sex === 'M' ? { son: 'மகன்', dat: 'மகனுக்கு', poss: 'அவனது', him: 'அவனை', to: 'அவனுக்கு', was: 'அனுமதிக்கப்பட்டான்' }
    : sex === 'F' ? { son: 'மகள்', dat: 'மகளுக்கு', poss: 'அவளது', him: 'அவளை', to: 'அவளுக்கு', was: 'அனுமதிக்கப்பட்டாள்' }
    : { son: 'மகன் / மகள்', dat: 'மகன் / மகளுக்கு', poss: 'அவரது', him: 'அவரை', to: 'அவருக்கு', was: 'அனுமதிக்கப்பட்டார்' };
  return text
    .replace('ஆகிய எனக்கு', `ஆகிய எனது ${P.dat}`)
    .replace('ஆகிய நான்', `ஆகிய எனது ${P.son}`)
    .replace(/அனுமதிக்கப்பட்டேன்/g, P.was)
    .replace(/என்னைப் /g, `${P.him}ப் `)
    .replace(/எனது (?!மக)/g, `${P.poss} `)
    .replace(/எனக்கு/g, P.to);
}

const ConsentForm = (() => {
  const DPI = 200;
  const W = Math.round(210 / 25.4 * DPI);
  const H = Math.round(297 / 25.4 * DPI);
  const MM = DPI / 25.4;
  const PT = DPI / 72;
  const SERIF = '"Noto Serif Tamil", "Tamil Sangam MN", "Latha", "Nirmala UI", "Noto Sans Tamil", serif';

  // The discharge summary's letterhead (Settings → Unit & letterhead), loaded before drawing.
  let lhImg = null;
  let lhSrc = '';
  async function letterhead() {
    const src = (typeof Store !== 'undefined' && Store.meta?.letterhead) || 'assets/letterhead.jpg';
    if (lhImg && lhSrc === src) return;
    lhSrc = src;
    lhImg = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  }
  async function fontsReady() {
    await letterhead().catch(() => {});
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
    const gapK = Math.max(0.7, Math.min(1, (pt - 7.5) / 3.5 * 0.3 + 0.7));
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

    // Header: the same letterhead as the discharge summary (24 mm tall, centred, at most 80% wide)
    if (lhImg) {
      let hh = 24 * MM;
      let w = lhImg.width * (hh / lhImg.height);
      if (w > CW * 0.8) { w = CW * 0.8; hh = lhImg.height * (w / lhImg.width); }
      g.drawImage(lhImg, (W - w) / 2, y, w, hh);
      y += hh;
    } else {
      font(14, 700); y += 14 * PT; center('அரசு இராசாசி மருத்துவமனை, மதுரை', y);
      font(10); y += 16 * PT; center('எலும்பு முறிவு சிகிச்சைத் துறை — Department of Orthopaedics and Traumatology', y);
    }
    font(12, 700); y += 19 * PT;
    {
      const t = `${tpl.title} — ${tpl.spine ? 'High Risk ' : ''}Informed Consent`;
      for (let fs = 12; fs > 8 && g.measureText(t).width > CW; fs -= 0.25) font(fs, 700); // fit the page width
      center(t, y);
    }
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
    box([['பெயர் / Name', `${consentNameTa(c)}${c.name ? ` / ${c.name}` : ''}`, CW]]);
    const sexW = (CW) * 0.36;
    const ipW = CW * 0.3;
    box([['வயது / Age', c.age, CW - sexW - ipW], ['பாலினம் / Sex', c.sex === 'M' ? 'MALE' : c.sex === 'F' ? 'FEMALE' : c.sex, sexW], ['IP No.', c.ipNo, ipW]]);
    box([['Diagnosis', c.diagnosis, CW]]);
    box([['Plan', c.plan, CW]]);
    y += 4 * MM;

    // Body: justified, first-line indent; blanks filled in bold + underline.
    const lh = pt * PT * 1.5;
    const indent = 10 * MM;
    const fills = { NAME: consentNameTa(c), PROC: consentProcImplant(c), SCREW: consentScrews(c), FRACTURE: consentExitFracture(c), IMPLANT: consentExitImplant(c) };
    const width = (tk) => {
      font(pt, tk.fill ? 700 : 400);
      return (tk.blank ? tk.blank * MM + (tk.t ? g.measureText(tk.t).width : 0) : g.measureText(tk.t).width);
    };
    const exit = consentIsExit(c);
    // Pelvis / acetabulum: "இடுப்பு எலும்பு" (hip bone) where the lower limb form says "கால் எலும்பு"
    const pelvic = (consentKind(c) === 'lower' && consentPelvic(c)) || consentKind(c) === 'pelvis';
    const paras = tpl.paras.map((t, i) => (!exit ? t : i === 0 ? CONSENT_EXIT_OPEN(consentExitFracture(c)) : /கொண்டு அறுவை சிகிச்சை செய்யும் போது|\{SCREW\} செலுத்தும்/.test(t) ? CONSENT_EXIT_PARA(tpl.bone) : t))
      .map((t) => (pelvic ? t.replace(/கால் எலும்பு/g, 'இடுப்பு எலும்பு') : t));
    // procedure-specific risks go just before the closing paragraph
    const extras = consentExtras(c, consentKind(c));
    paras.splice(paras.length - 1, 0, ...extras);
    // the spine paragraph says it in full: drop the template's one-line "CSF leak may occur"
    if (extras.some((x) => x.includes('(CSF)'))) paras.forEach((t, i) => { if (!t.includes('(CSF)')) paras[i] = t.replace(/\s*மேலும் தண்டுவட நீர் கசிவு ஏற்படலாம் என அறிவேன்\.?/, ''); });
    const minor = consentMinor(c);
    for (const p0 of paras) {
      const p = minor ? consentForChild(p0, c.sex) : p0;
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
      y += 8 * MM * gapK;
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
    y += slh + 13 * MM * gapK;
    const bw = 68 * MM;
    rule(M, y, bw);
    rule(M + CW - bw, y, bw);
    y += 1.5 * MM;
    const right = (text, yy) => g.fillText(text, M + CW - g.measureText(text).width, yy);
    const rows = minor
      ? [['சாட்சி கையொப்பம் / Witness Signature', 'பெற்றோர் / பாதுகாவலர் கையொப்பம்', 700], ['', 'Parent / Guardian Signature', 400]]
      : tpl.spine
      ? [['சாட்சி / Witness', 'நோயாளி / Patient', 700], ['கையொப்பம் / பெருவிரல் ரேகை', 'கையொப்பம் / பெருவிரல் ரேகை', 400]]
      : [['சாட்சி கையொப்பம் / Witness Signature', 'நோயாளியின் கையொப்பம் / Patient Signature', 700], ['', '(கையொப்பம் / கைரேகை)', 400]];
    for (const [l, r, wgt] of rows) {
      font(spt, wgt);
      g.fillText(l, M, y + spt * PT);
      if (r) right(r, y + spt * PT);
      y += slh;
    }
    // Doctor's signature, centred below
    y += 11 * MM * gapK;
    rule((W - bw) / 2, y, bw);
    y += 1.5 * MM;
    font(spt, 700);
    center("மருத்துவரின் கையொப்பம் / Doctor's Signature", y + spt * PT);
    y += slh;
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
    for (let pt = 11; pt >= 7; pt -= 0.25) {
      if (draw(g, c, draft, pt) <= bottom || pt <= 7) break;
    }
    return cv;
  }

  return { page, fontsReady, kind: consentKind, isExit: consentIsExit, minor: consentMinor, forChild: consentForChild, exitBone: consentExitBone, fracture: consentExitFracture, exitImplant: consentExitImplant, procImplant: consentProcImplant, nameTa: consentNameTa, label: (c) => CONSENT_TPLS[consentKind(c)].label };
})();

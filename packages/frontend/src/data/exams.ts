/**
 * Popular government exams shown on the landing page ("Prepare for").
 *
 * Exams that exist in the database are marked "available" at runtime by matching `en` against the
 * live exam names, so keep the English name identical to the admin exam name for those. Every other
 * entry is shown as "coming soon".
 */
export type ExamRegion = 'up' | 'bihar' | 'uk' | 'raj' | 'mp' | 'central' | 'other';

export interface PopularExam {
  en: string;
  hi: string;
  region: ExamRegion;
}

export const EXAM_REGIONS: { id: ExamRegion; en: string; hi: string }[] = [
  { id: 'up', en: 'Uttar Pradesh', hi: 'उत्तर प्रदेश' },
  { id: 'bihar', en: 'Bihar', hi: 'बिहार' },
  { id: 'uk', en: 'Uttarakhand', hi: 'उत्तराखंड' },
  { id: 'raj', en: 'Rajasthan', hi: 'राजस्थान' },
  { id: 'mp', en: 'Madhya Pradesh', hi: 'मध्य प्रदेश' },
  { id: 'central', en: 'Central', hi: 'केंद्रीय' },
  { id: 'other', en: 'Other states', hi: 'अन्य राज्य' },
];

const e = (region: ExamRegion, en: string, hi: string): PopularExam => ({ region, en, hi });

export const POPULAR_EXAMS: PopularExam[] = [
  // Uttar Pradesh
  e('up', 'UP Police Constable', 'यूपी पुलिस कांस्टेबल'),
  e('up', 'UP Police SI', 'यूपी पुलिस एसआई'),
  e('up', 'UP SI Civil', 'यूपी एसआई सिविल'),
  e('up', 'UP SI Platoon Commander', 'यूपी एसआई प्लाटून कमांडर'),
  e('up', 'UP Police Head Operator', 'यूपी पुलिस हेड ऑपरेटर'),
  e('up', 'UP Police ASI', 'यूपी पुलिस एएसआई'),
  e('up', 'UP Police Fireman', 'यूपी पुलिस फायरमैन'),
  e('up', 'UP Jail Warder', 'यूपी जेल वार्डर'),
  e('up', 'UPSSSC PET', 'यूपीएसएसएससी पीईटी'),
  e('up', 'UP Lekhpal', 'यूपी लेखपाल'),
  e('up', 'UPSSSC Junior Assistant', 'यूपीएसएसएससी जूनियर असिस्टेंट'),
  e('up', 'UP Gram Vikas Adhikari (VDO)', 'यूपी ग्राम विकास अधिकारी'),
  e('up', 'UPTET', 'यूपीटीईटी'),
  e('up', 'UP Super TET', 'यूपी सुपर टेट'),
  e('up', 'UP Assistant Teacher', 'यूपी सहायक अध्यापक'),
  e('up', 'UP TGT / PGT', 'यूपी टीजीटी / पीजीटी'),
  e('up', 'UP Home Guard', 'यूपी होमगार्ड'),
  e('up', 'UP Forest Guard', 'यूपी वन रक्षक'),
  e('up', 'UPPSC PCS', 'यूपीपीएससी पीसीएस'),

  // Bihar
  e('bihar', 'Bihar Police Constable', 'बिहार पुलिस कांस्टेबल'),
  e('bihar', 'Bihar Police SI', 'बिहार पुलिस दारोगा (एसआई)'),
  e('bihar', 'Bihar Police Fireman', 'बिहार पुलिस फायरमैन'),
  e('bihar', 'Bihar Prohibition Constable', 'बिहार मद्य निषेध सिपाही'),
  e('bihar', 'Bihar Home Guard', 'बिहार होमगार्ड'),
  e('bihar', 'BPSC TRE (Teacher)', 'बीपीएससी टीआरई शिक्षक'),
  e('bihar', 'Bihar STET', 'बिहार एसटीईटी'),
  e('bihar', 'BSSC Inter Level', 'बीएसएससी इंटर लेवल'),
  e('bihar', 'BPSC', 'बीपीएससी'),

  // Uttarakhand
  e('uk', 'Uttarakhand Police Constable', 'उत्तराखंड पुलिस कांस्टेबल'),
  e('uk', 'Uttarakhand Police SI', 'उत्तराखंड पुलिस एसआई'),
  e('uk', 'UKSSSC Patwari / Lekhpal', 'उत्तराखंड पटवारी / लेखपाल'),
  e('uk', 'UKSSSC Forest Guard', 'उत्तराखंड वन रक्षक'),
  e('uk', 'UKSSSC VPDO', 'उत्तराखंड वीपीडीओ'),
  e('uk', 'UKSSSC Group C', 'उत्तराखंड ग्रुप सी'),
  e('uk', 'UTET', 'उत्तराखंड टीईटी'),
  e('uk', 'UKPSC PCS', 'यूकेपीएससी पीसीएस'),

  // Rajasthan
  e('raj', 'Rajasthan Police Constable', 'राजस्थान पुलिस कांस्टेबल'),
  e('raj', 'Rajasthan Police SI', 'राजस्थान पुलिस एसआई'),
  e('raj', 'RSMSSB Patwari', 'राजस्थान पटवारी'),
  e('raj', 'REET', 'रीट (REET)'),
  e('raj', 'Rajasthan 4th Grade', 'राजस्थान चतुर्थ श्रेणी'),
  e('raj', 'RSMSSB VDO', 'राजस्थान ग्राम विकास अधिकारी'),
  e('raj', 'RSMSSB Junior Assistant', 'राजस्थान जूनियर असिस्टेंट'),
  e('raj', 'RPSC RAS', 'आरपीएससी आरएएस'),
  e('raj', 'Rajasthan Jail Prahari', 'राजस्थान जेल प्रहरी'),

  // Madhya Pradesh
  e('mp', 'MP Police Constable', 'एमपी पुलिस आरक्षक'),
  e('mp', 'MP Police SI', 'एमपी पुलिस एसआई'),
  e('mp', 'MPESB Patwari', 'एमपी पटवारी'),
  e('mp', 'MP TET', 'एमपी टीईटी'),
  e('mp', 'MPESB Group 4', 'एमपी ग्रुप 4'),
  e('mp', 'MP Forest Guard', 'एमपी वन रक्षक'),
  e('mp', 'MP Jail Prahari', 'एमपी जेल प्रहरी'),
  e('mp', 'MPPSC', 'एमपीपीएससी'),

  // Central
  e('central', 'SSC CGL', 'एसएससी सीजीएल'),
  e('central', 'SSC CHSL', 'एसएससी सीएचएसएल'),
  e('central', 'SSC MTS', 'एसएससी एमटीएस'),
  e('central', 'SSC GD Constable', 'एसएससी जीडी कांस्टेबल'),
  e('central', 'SSC CPO', 'एसएससी सीपीओ'),
  e('central', 'SSC Stenographer', 'एसएससी स्टेनोग्राफर'),
  e('central', 'RRB NTPC', 'आरआरबी एनटीपीसी'),
  e('central', 'RRB Group D', 'आरआरबी ग्रुप डी'),
  e('central', 'RRB ALP', 'आरआरबी एएलपी'),
  e('central', 'RPF Constable', 'आरपीएफ कांस्टेबल'),
  e('central', 'Delhi Police Constable', 'दिल्ली पुलिस कांस्टेबल'),
  e('central', 'CRPF Constable', 'सीआरपीएफ कांस्टेबल'),
  e('central', 'IBPS PO', 'आईबीपीएस पीओ'),
  e('central', 'IBPS Clerk', 'आईबीपीएस क्लर्क'),
  e('central', 'SBI PO', 'एसबीआई पीओ'),
  e('central', 'SBI Clerk', 'एसबीआई क्लर्क'),
  e('central', 'CTET', 'सीटीईटी'),
  e('central', 'NDA', 'एनडीए'),
  e('central', 'Agniveer', 'अग्निवीर'),
  e('central', 'UPSC CSE', 'यूपीएससी सिविल सेवा'),

  // Other states
  e('other', 'Haryana CET', 'हरियाणा सीईटी'),
  e('other', 'Haryana Police Constable', 'हरियाणा पुलिस कांस्टेबल'),
  e('other', 'HTET', 'एचटीईटी'),
];

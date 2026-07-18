/**
 * Plain-language descriptions of what each test measures.
 *
 * This is the product's original promise, not decoration. "Complex medical
 * jargon" is the third problem named in the pitch: a report that says MCHC 32.7
 * is unreadable to the person whose body it describes, and printing it on a
 * screen changes nothing.
 *
 * Two rules for every line here:
 *
 * 1. Describe what the test *measures*, never what a result means. "How much
 *    your red cell sizes vary" is a description. "High values suggest anaemia"
 *    is a diagnosis, and this file must not contain one.
 *
 * 2. No jargon in the explanation itself. Explaining haematocrit with
 *    "erythrocyte volume fraction" helps nobody.
 */

interface Explanation {
  /** One line, under ~70 characters, readable by anyone. */
  what: string;
}

export const EXPLANATIONS: Record<string, Explanation> = {
  // Red cells
  hemoglobin: { what: 'Carries oxygen from your lungs to the rest of your body' },
  rbc: { what: 'How many red blood cells you have' },
  hct: { what: 'What share of your blood is made up of red cells' },
  mcv: { what: 'The average size of your red blood cells' },
  mch: { what: 'The average amount of oxygen-carrying protein per red cell' },
  mchc: { what: 'How tightly packed that protein is inside each red cell' },
  rdw: { what: 'How much your red blood cells vary in size' },

  // White cells
  wbc: { what: 'Your total infection-fighting cells' },
  neutrophils: { what: 'The white cells that respond first to bacterial infection' },
  lymphocytes: { what: 'The white cells that deal with viruses and build immunity' },
  eosinophils: { what: 'White cells linked to allergies and parasites' },
  monocytes: { what: 'White cells that clear away damaged cells and debris' },
  basophils: { what: 'The rarest white cells, involved in allergic reactions' },

  // Platelets
  platelets: { what: 'The cells that help your blood clot and stop bleeding' },
  mpv: { what: 'The average size of your platelets' },
  pdw: { what: 'How much your platelets vary in size' },

  // Blood sugar
  hba1c: { what: 'Your average blood sugar over the past 2 to 3 months' },
  fasting_glucose: { what: 'Your blood sugar after not eating overnight' },

  // Cholesterol
  total_cholesterol: { what: 'All the cholesterol circulating in your blood' },
  ldl: { what: 'The cholesterol that can build up inside artery walls' },
  hdl: { what: 'The cholesterol that helps clear the other kind away' },
  triglycerides: { what: 'Fat carried in your blood, mostly from food and alcohol' },

  // Organs
  alt: { what: 'A liver enzyme that leaks into the blood when liver cells are stressed' },
  ast: { what: 'An enzyme found in the liver, heart and muscles' },
  creatinine: { what: 'A waste product your kidneys filter out' },
  uric_acid: { what: 'A waste product that can collect in joints' },

  // Thyroid and vitamins
  tsh: { what: 'The signal your brain sends to control your thyroid' },
  vitamin_d: { what: 'Helps your body absorb calcium for bones and muscles' },
  vitamin_b12: { what: 'Needed to make red blood cells and keep nerves healthy' },
};

/** What each panel is for, in a phrase. */
export const PANEL_PURPOSE: Record<string, string> = {
  'Red cells': 'How well your blood carries oxygen',
  'White cells': 'How your body fights infection',
  Platelets: 'How well your blood clots',
  'Blood sugar': 'How your body handles sugar',
  Cholesterol: 'Fats in your blood and your heart risk',
  Liver: 'How your liver is coping',
  Kidney: 'How your kidneys are filtering',
  Thyroid: 'The gland that sets your metabolism',
  Vitamins: 'Nutrient levels',
  'Other results': 'Additional tests from this report',
};

export const explain = (name: string): string | null =>
  EXPLANATIONS[name]?.what ?? null;

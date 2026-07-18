/**
 * Groups biomarkers into the panels a lab actually prints.
 *
 * A flat list of sixteen results is how the report already looks on paper, and
 * it is the thing people cannot read. Grouping restores the structure the lab
 * intended: haemoglobin, MCV and RDW mean something together that none of them
 * mean alone.
 *
 * Anything unrecognised falls into "Other results" rather than being dropped.
 */

import type { Biomarker } from './types';

export interface Panel {
  name: string;
  markers: Biomarker[];
}

const PANELS: Array<[string, string[]]> = [
  ['Red cells', ['hemoglobin', 'rbc', 'hct', 'mcv', 'mch', 'mchc', 'rdw']],
  [
    'White cells',
    ['wbc', 'neutrophils', 'lymphocytes', 'eosinophils', 'monocytes', 'basophils'],
  ],
  ['Platelets', ['platelets', 'mpv', 'pdw']],
  ['Blood sugar', ['hba1c', 'fasting_glucose']],
  ['Cholesterol', ['total_cholesterol', 'ldl', 'hdl', 'triglycerides']],
  ['Liver', ['alt', 'ast']],
  ['Kidney', ['creatinine', 'uric_acid']],
  ['Thyroid', ['tsh']],
  ['Vitamins', ['vitamin_d', 'vitamin_b12']],
];

export function groupIntoPanels(markers: Biomarker[]): Panel[] {
  const remaining = new Map(markers.map((m) => [m.name, m]));
  const panels: Panel[] = [];

  for (const [name, keys] of PANELS) {
    const found: Biomarker[] = [];
    for (const key of keys) {
      const marker = remaining.get(key);
      if (marker) {
        found.push(marker);
        remaining.delete(key);
      }
    }
    if (found.length) panels.push({ name, markers: found });
  }

  if (remaining.size) {
    panels.push({ name: 'Other results', markers: [...remaining.values()] });
  }

  // Panels containing something abnormal come first. A user scanning a report
  // should meet the findings that need attention before the ones that do not.
  return panels.sort((a, b) => {
    const flagged = (p: Panel) =>
      p.markers.some((m) => m.flag === 'low' || m.flag === 'high') ? 1 : 0;
    return flagged(b) - flagged(a);
  });
}

/**
 * The panels AURA can compare against a reference range.
 *
 * Counts come from the marker table in the backend, not from a marketing list.
 * A page that claims to support a panel it has no ranges for would flag nothing
 * on that report and leave the user believing everything was checked.
 *
 * A report containing tests outside these panels is still read and stored --
 * the values simply come back without a range, and are labelled "no range"
 * rather than quietly assumed normal.
 */

import Chip from '../../../components/ui/Chip';

const PANELS: Array<[string, number]> = [
  ['Complete Blood Count', 16],
  ['Lipid profile', 4],
  ['Blood sugar', 2],
  ['Liver function', 2],
  ['Kidney function', 2],
  ['Thyroid', 1],
  ['Vitamins', 2],
];

const TOTAL = PANELS.reduce((sum, [, n]) => sum + n, 0);

export default function SupportedPanels() {
  return (
    <div>
      <span className="card-label">WHAT AURA CAN READ</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'var(--space-3)' }}>
        {PANELS.map(([name, count]) => (
          <Chip key={name} title={`${count} markers with reference ranges`}>
            {name}
          </Chip>
        ))}
      </div>
      <small style={{ display: 'block', marginTop: 'var(--space-3)', opacity: 0.7 }}>
        {TOTAL} markers have reference ranges built in. Other tests are still extracted
        and stored — they are shown without a range rather than assumed normal.
      </small>
    </div>
  );
}
